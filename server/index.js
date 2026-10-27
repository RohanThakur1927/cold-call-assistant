require('dotenv').config()

const express = require('express')
const cors = require('cors')
const { createClient } = require('@supabase/supabase-js')

const app = express()
const PORT = process.env.PORT || 5000

const FRONTEND_ORIGIN =
  process.env.FRONTEND_ORIGIN || 'http://localhost:5173'

const GEMINI_MODEL =
  process.env.GEMINI_MODEL || 'gemini-3.6-flash'

if (
  !process.env.SUPABASE_URL ||
  !process.env.SUPABASE_SERVICE_ROLE_KEY
) {
  throw new Error('Missing Supabase settings in server/.env')
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

app.use(cors({ origin: FRONTEND_ORIGIN }))
app.use(express.json({ limit: '100kb' }))

const stages = [
  'Opening',
  'Purpose',
  'Permission',
  'Their business',
  'Their need',
  'Objection',
  'Next step',
  'Close',
]

const validOutcomes = [
  'Meeting booked',
  'Follow-up required',
  'Interested',
  'Not interested',
  'No answer',
]

const validFollowUpStatuses = [
  'Pending',
  'Completed',
  'Cancelled',
]

// Verify the signed-in user's Supabase access token.
async function requireUser(req, res, next) {
  const authHeader = req.headers.authorization || ''
  const match = authHeader.match(/^Bearer\s+(.+)$/i)

  if (!match) {
    return res.status(401).json({
      error: 'Please sign in to continue.',
    })
  }

  try {
    const { data, error } = await supabase.auth.getUser(match[1])

    if (error || !data?.user) {
      return res.status(401).json({
        error: 'Your session is invalid or expired. Please sign in again.',
      })
    }

    req.user = data.user
    return next()
  } catch (error) {
    console.error(
      'Authentication verification failed:',
      error.message
    )

    return res.status(401).json({
      error: 'Could not verify your session.',
    })
  }
}

// Health check.
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'CallPilot API',
  })
})

// Parse JSON returned by Gemini.
function parseGeminiJson(text) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Gemini returned an empty response.')
  }

  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()

  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')

    if (start === -1 || end <= start) {
      throw new Error('No JSON object found in Gemini response.')
    }

    return JSON.parse(cleaned.slice(start, end + 1))
  }
}

// AI stage suggestion.
app.post('/api/ai/suggest-stage', requireUser, async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        error: 'Gemini is not configured. Add GEMINI_API_KEY to server/.env.',
      })
    }

    const {
      currentStage,
      prospectWords,
      company,
    } = req.body || {}

    if (
      !Number.isInteger(currentStage) ||
      currentStage < 1 ||
      currentStage > 8
    ) {
      return res.status(400).json({
        error: 'Current stage must be a number from 1 to 8.',
      })
    }

    if (
      typeof prospectWords !== 'string' ||
      !prospectWords.trim()
    ) {
      return res.status(400).json({
        error: "Enter the prospect's words before requesting a suggestion.",
      })
    }

    if (prospectWords.length > 5000) {
      return res.status(400).json({
        error: 'Prospect notes must be 5000 characters or fewer.',
      })
    }

    if (
      company != null &&
      (typeof company !== 'string' || company.length > 200)
    ) {
      return res.status(400).json({
        error: 'Company name is invalid or too long.',
      })
    }

    const prompt = `
You are an assistant helping a salesperson during a live cold call.

The eight call stages, in order, are:
${stages.map((stage, index) => `${index + 1}. ${stage}`).join('\n')}

Current stage: ${currentStage}. ${stages[currentStage - 1]}
Company: ${company?.trim() || 'Not provided'}

The prospect's exact words:
"""
${prospectWords.trim()}
"""

Choose the most appropriate stage for the NEXT step.
Use the prospect's actual words as evidence.
Do not automatically choose the next numbered stage.
If the prospect has clearly ended the call, recommend stage 8 (Close).

Provide a short, natural sentence the caller could say next.
Do not invent facts or claim the prospect agreed to something they did not say.

Return ONLY a valid JSON object:
{
  "suggestedStageNumber": 1,
  "reason": "One short explanation",
  "suggestedResponse": "One natural sentence the caller could say"
}
`.trim()

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1024,
            responseMimeType: 'application/json',
          },
        }),
        signal: AbortSignal.timeout(60000),
      }
    )

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))

      console.error(
        'Gemini request failed:',
        response.status,
        errorBody.error?.message || 'Unknown provider error'
      )

      if (response.status === 429) {
        return res.status(503).json({
          error: 'Gemini rate limit reached. Please try again later.',
        })
      }

      if (
        response.status === 503 ||
        response.status === 500
      ) {
        return res.status(503).json({
          error: 'Gemini is temporarily unavailable. Please try again shortly.',
        })
      }

      if (
        response.status === 401 ||
        response.status === 403
      ) {
        return res.status(502).json({
          error: 'Gemini rejected the API key. Check your server configuration.',
        })
      }

      return res.status(502).json({
        error: 'Gemini could not generate a suggestion. Please try again.',
      })
    }

    const result = await response.json()
    const candidate = result.candidates?.[0]

    const generatedText = candidate?.content?.parts
      ?.map(part => part.text || '')
      .join('')
      .trim()

    if (!generatedText) {
      return res.status(502).json({
        error: 'Gemini returned an empty suggestion. Please try again.',
      })
    }

    let suggestion

    try {
      suggestion = parseGeminiJson(generatedText)
    } catch (error) {
      console.error('Gemini returned invalid JSON:', error.message)

      return res.status(502).json({
        error: 'Gemini returned an incomplete suggestion. Please try again.',
      })
    }

    const stageNumber = suggestion.suggestedStageNumber

    if (
      !Number.isInteger(stageNumber) ||
      stageNumber < 1 ||
      stageNumber > 8 ||
      typeof suggestion.reason !== 'string' ||
      typeof suggestion.suggestedResponse !== 'string' ||
      !suggestion.reason.trim() ||
      !suggestion.suggestedResponse.trim()
    ) {
      return res.status(502).json({
        error: 'Gemini returned an incomplete suggestion. Please try again.',
      })
    }

    return res.json({
      suggestedStageNumber: stageNumber,
      suggestedStage: stages[stageNumber - 1],
      reason: suggestion.reason.trim().slice(0, 1000),
      suggestedResponse: suggestion.suggestedResponse.trim().slice(0, 2000),
      model: GEMINI_MODEL,
    })
  } catch (error) {
    if (
      error.name === 'TimeoutError' ||
      error.name === 'AbortError'
    ) {
      return res.status(504).json({
        error: 'Gemini took longer than 60 seconds to respond. Please try again.',
      })
    }

    console.error('AI stage suggestion failed:', error.message)

    return res.status(500).json({
      error: 'Unable to generate a stage suggestion.',
    })
  }
})

// Validate call details, duration, and follow-up fields.
function validateCallBody(body) {
  const {
    prospect,
    company,
    outcome,
    stageReached,
    stageNotes,
    durationSeconds,
    followUpDate,
    followUpStatus,
  } = body || {}

  if (
    typeof prospect !== 'string' ||
    !prospect.trim()
  ) {
    return 'Prospect name is required.'
  }

  if (prospect.length > 200) {
    return 'Prospect name is too long.'
  }

  if (
    company != null &&
    (typeof company !== 'string' || company.length > 200)
  ) {
    return 'Company name is invalid or too long.'
  }

  if (!validOutcomes.includes(outcome)) {
    return 'Choose a valid call outcome.'
  }

  if (
    !Number.isInteger(stageReached) ||
    stageReached < 1 ||
    stageReached > 8
  ) {
    return 'Stage reached must be a number from 1 to 8.'
  }

  if (
    !Array.isArray(stageNotes) ||
    stageNotes.length !== 8 ||
    stageNotes.some(
      note => typeof note !== 'string' || note.length > 10000
    )
  ) {
    return 'Provide notes as eight separate text values.'
  }

  if (
    durationSeconds !== undefined &&
    (
      !Number.isInteger(durationSeconds) ||
      durationSeconds < 0 ||
      durationSeconds > 86400
    )
  ) {
    return 'Call duration must be a whole number of seconds between 0 and 86400.'
  }

  if (
    followUpDate !== undefined &&
    followUpDate !== null &&
    followUpDate !== ''
  ) {
    if (
      typeof followUpDate !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(followUpDate)
    ) {
      return 'Follow-up date must use YYYY-MM-DD format.'
    }

    const parsedDate = new Date(`${followUpDate}T00:00:00Z`)

    if (
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== followUpDate
    ) {
      return 'Follow-up date is invalid.'
    }
  }

  if (
    followUpStatus !== undefined &&
    followUpStatus !== null &&
    !validFollowUpStatuses.includes(followUpStatus)
  ) {
    return 'Choose Pending, Completed, or Cancelled for follow-up status.'
  }

  return null
}

function makeStageRecords(callId, stageNotes) {
  return stages.map((stageName, index) => ({
    call_id: callId,
    stage_number: index + 1,
    stage_name: stageName,
    prospect_notes: stageNotes[index],
  }))
}

// Create a new call.
app.post('/api/calls', requireUser, async (req, res) => {
  let callId

  try {
    const validationError = validateCallBody(req.body)

    if (validationError) {
      return res.status(400).json({
        error: validationError,
      })
    }

    const {
      prospect,
      company,
      outcome,
      stageReached,
      stageNotes,
      durationSeconds,
      followUpDate,
      followUpStatus,
    } = req.body

    const { data: call, error: callError } = await supabase
      .from('calls')
      .insert({
        user_id: req.user.id,
        prospect: prospect.trim(),
        company: company?.trim() || null,
        outcome,
        stage_reached: stageReached,

        ...(durationSeconds !== undefined
          ? { duration_seconds: durationSeconds }
          : {}),

        follow_up_date: followUpDate || null,

        follow_up_status: followUpDate
          ? (followUpStatus || 'Pending')
          : (followUpStatus || null),
      })
      .select()
      .single()

    if (callError) throw callError

    callId = call.id

    const { error: stageError } = await supabase
      .from('call_stages')
      .insert(makeStageRecords(callId, stageNotes))

    if (stageError) throw stageError

    return res.status(201).json({
      message: 'Call saved successfully.',
      call,
    })
  } catch (error) {
    if (callId) {
      const { error: cleanupStagesError } = await supabase
        .from('call_stages')
        .delete()
        .eq('call_id', callId)

      if (cleanupStagesError) {
        console.error(
          'Stage cleanup failed:',
          cleanupStagesError.message
        )
      }

      const { error: cleanupCallError } = await supabase
        .from('calls')
        .delete()
        .eq('id', callId)
        .eq('user_id', req.user.id)

      if (cleanupCallError) {
        console.error(
          'Call cleanup failed:',
          cleanupCallError.message
        )
      }
    }

    console.error('Save call failed:', error.message)

    return res.status(500).json({
      error: 'Unable to save call. Check backend logs.',
    })
  }
})

// Update an existing call.
app.put('/api/calls/:id', requireUser, async (req, res) => {
  const callId = req.params.id

  try {
    const validationError = validateCallBody(req.body)

    if (validationError) {
      return res.status(400).json({
        error: validationError,
      })
    }

    const {
      prospect,
      company,
      outcome,
      stageReached,
      stageNotes,
      durationSeconds,
      followUpDate,
      followUpStatus,
    } = req.body

    const { data: existingCall, error: lookupError } =
      await supabase
        .from('calls')
        .select('id')
        .eq('id', callId)
        .eq('user_id', req.user.id)
        .maybeSingle()

    if (lookupError) throw lookupError

    if (!existingCall) {
      return res.status(404).json({
        error: 'Saved call not found.',
      })
    }

    const updateData = {
      prospect: prospect.trim(),
      company: company?.trim() || null,
      outcome,
      stage_reached: stageReached,
    }

    if (durationSeconds !== undefined) {
      updateData.duration_seconds = durationSeconds
    }

    // Only update follow-up fields when they were supplied.
    if (followUpDate !== undefined) {
      updateData.follow_up_date = followUpDate || null

      updateData.follow_up_status = followUpDate
        ? (followUpStatus || 'Pending')
        : (followUpStatus || null)
    } else if (followUpStatus !== undefined) {
      updateData.follow_up_status = followUpStatus || null
    }

    const { data: updatedCall, error: updateError } =
      await supabase
        .from('calls')
        .update(updateData)
        .eq('id', callId)
        .eq('user_id', req.user.id)
        .select()
        .single()

    if (updateError) throw updateError

    const { error: deleteStagesError } = await supabase
      .from('call_stages')
      .delete()
      .eq('call_id', callId)

    if (deleteStagesError) throw deleteStagesError

    const { error: insertStagesError } = await supabase
      .from('call_stages')
      .insert(makeStageRecords(callId, stageNotes))

    if (insertStagesError) {
      console.error(
        'Stage-note replacement failed:',
        insertStagesError.message
      )

      return res.status(500).json({
        error:
          'Call details were updated, but stage notes could not be saved. Please retry.',
      })
    }

    return res.json({
      message: 'Call updated successfully.',
      call: updatedCall,
    })
  } catch (error) {
    console.error('Update call failed:', error.message)

    return res.status(500).json({
      error: 'Unable to update call. Check backend logs.',
    })
  }
})

// Fetch the signed-in user's calls and their stage notes.
app.get('/api/calls', requireUser, async (req, res) => {
  try {
    const { data: calls, error: callsError } = await supabase
      .from('calls')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })

    if (callsError) throw callsError

    if (!calls?.length) {
      return res.json([])
    }

    const callIds = calls.map(call => call.id)

    const { data: stageRecords, error: stageError } =
      await supabase
        .from('call_stages')
        .select('*')
        .in('call_id', callIds)
        .order('stage_number')

    if (stageError) throw stageError

    const stagesByCall = new Map()

    for (const stage of stageRecords || []) {
      if (!stagesByCall.has(stage.call_id)) {
        stagesByCall.set(stage.call_id, [])
      }

      stagesByCall.get(stage.call_id).push(stage)
    }

    const result = calls.map(call => ({
      ...call,
      stages: stagesByCall.get(call.id) || [],
    }))

    return res.json(result)
  } catch (error) {
    console.error('Fetch calls failed:', error.message)

    return res.status(500).json({
      error: 'Unable to retrieve calls.',
    })
  }
})

app.listen(PORT, () => {
  console.log(`CallPilot API running at http://localhost:${PORT}`)
})