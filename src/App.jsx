
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import './App.css'

const API_URL = 'https://callpilot-api-odtr.onrender.com/api'

const stages = [
  ['Opening', 'Confirm you have reached the right person and open the conversation naturally.'],
  ['Purpose', 'Explain who you are and why you called in one or two sentences.'],
  ['Permission', 'Check whether they can spare a moment; respect a request to call back.'],
  ['Their business', 'Understand the prospect’s role and business before making assumptions.'],
  ['Their need', 'Listen for the prospect’s own words about goals, problems, or priorities.'],
  ['Objection', 'Understand the concern, respond briefly, and respect a clear refusal.'],
  ['Next step', 'Agree on a specific action, owner, and time—or record that none was agreed.'],
  ['Close', 'End politely and record the actual outcome, including early endings.'],
]

const prompts = [
  '“Hello—am I speaking with [name]?”',
  '“I’m [name] from Meridian Growth Partners. I’m calling about growth analysis and growth work for businesses.”',
  '“Have I caught you at a bad time, or can I take 20 seconds to explain?”',
  '“Could you tell me a little about your role and what your team is focused on?”',
  '“What is the biggest challenge affecting your team’s goals right now?”',
  '“When you say you already have support, what does that support cover?”',
  '“Would it be useful if I sent the report and called you on [day/time]?”',
  '“Thanks for your time. I’ll follow the next step we agreed—or I won’t contact you again if you asked me not to.”',
]

const stageExamples = [
  [
    '“Hello.”',
    '“Who is speaking?”',
    '“You have the wrong person.”',
  ],
  [
    '“What is this regarding?”',
    '“How did you get my number?”',
    '“Is this a sales call?”',
  ],
  [
    '“I’m in a meeting—call later.”',
    '“Send me the details first.”',
    '“I can speak for a minute.”',
  ],
  [
    '“I handle this area, but not the final decision.”',
    '“That person has left the company.”',
    '“We are a small team.”',
  ],
  [
    '“We already have a consultant.”',
    '“Our current process is working.”',
    '“We are not focused on that right now.”',
  ],
  [
    '“We already work with someone.”',
    '“Just send me something on WhatsApp.”',
    '“I’m not interested.”',
  ],
  [
    '“Call me Thursday afternoon.”',
    '“Send the report and follow up.”',
    '“No next step agreed.”',
  ],
  [
    '“Thank you.”',
    '“Please don’t call again.”',
    '“The call ended before we agreed anything.”',
  ],
]

const stageActions = [
  ['Reached the right person', 'Wrong person', 'Person left company', 'No response'],
  ['Explained purpose', 'Asked who we are', 'Asked how number was obtained', 'Ended early'],
  ['Permission granted', 'Busy—callback requested', 'Asked for written details', 'Could not continue'],
  ['Role clarified', 'Not decision-maker', 'Company context captured', 'Could not establish context'],
  ['Need stated', 'Existing solution mentioned', 'No need identified', 'Prospect declined to discuss'],
  ['Concern clarified', 'Asked for report', 'Not interested', 'Do not contact again'],
  ['Meeting agreed', 'Callback time agreed', 'Report agreed', 'No next step agreed'],
  ['Closed politely', 'Follow-up recorded', 'Do not contact', 'Call ended unexpectedly'],
]

const faqs = [
  {
    question: 'How do I start a new call?',
    answer:
      'Choose New Call in the sidebar, enter the prospect name and company, and move through the eight stages. Select the outcome and click Save Call when you finish.',
  },
  {
    question: 'What are the eight call stages?',
    answer:
      'Opening, Reason for Calling, Discovery, Qualification, Value Proposition, Objection Handling, Closing, and Call Outcome. Each stage includes guidance and a suggested question.',
  },
  {
    question: 'Where can I find saved calls?',
    answer:
      'Open Call History in the sidebar. Your saved calls are associated with your signed-in account and should remain available after refreshing or signing back in.',
  },
  {
    question: 'Can I save notes for each stage?',
    answer:
      'Yes. Add notes in each stage while working through a call, then save the call with its outcome to store the call and stage notes.',
  },
  {
    question: 'How do I change my username?',
    answer:
      'Open Settings, edit the Username field, and click Save username. Your username is saved to your Supabase account profile.',
  },
  {
    question: 'What if I cannot sign in?',
    answer:
      'Check that you are using the correct account. For email login, use Forgot password on the sign-in screen. You can also use Continue with Google if that is how you normally sign in.',
  },
  {
    question: 'Why can’t I see my saved calls?',
    answer:
      'Check that you are signed in to the same account used to save the calls. Make sure the backend server is running and try refreshing the page.',
  },
]

const emptyForm = () => ({
  prospect: '',
  company: '',
  stageNotes: Array(8).fill(''),
  outcome: '',
  followUpDate: '',
  followUpStatus: 'Pending',
})

function formatCallDate(call) {
  const dateValue = call.created_at || call.date
  if (!dateValue) return 'Date unavailable'

  const date = new Date(dateValue)
  return Number.isNaN(date.getTime())
    ? String(dateValue)
    : date.toLocaleString()
}

function AuthScreen() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setNotice('')
    setError('')

    try {
      if (mode === 'signup') {
        const { data, error: authError } =
          await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              emailRedirectTo: window.location.origin,
            },
          })

        if (authError) throw authError

        if (data.session) {
          setNotice('Account created. You are now signed in.')
        } else {
          setNotice(
            'Account created. Check your email to confirm your account, then sign in.',
          )
          setMode('login')
        }
      } else if (mode === 'login') {
        const { error: authError } =
          await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          })

        if (authError) throw authError
      } else {
        const { error: authError } =
          await supabase.auth.resetPasswordForEmail(
            email.trim(),
            { redirectTo: window.location.origin },
          )

        if (authError) throw authError

        setNotice(
          'If an account exists for that email, a password-reset link has been sent.',
        )
      }
    } catch (authError) {
      setError(authError.message || 'Authentication failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function signInWithGoogle() {
    setBusy(true)
    setError('')
    setNotice('')

    try {
      const { error: authError } =
        await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin },
        })

      if (authError) throw authError
    } catch (authError) {
      setError(authError.message || 'Google sign-in could not start.')
      setBusy(false)
    }
  }

  return (
    <div className="app light-theme auth-screen">
      <style>{`
        .auth-screen { min-height:100vh; display:flex; flex-direction:column; }
        .auth-main { width:min(440px, calc(100% - 32px)); margin:64px auto; }
        .auth-card { padding:32px; border:1px solid #e2e8f0; border-radius:24px; background:#fff; color:#242039; box-shadow:0 20px 70px rgba(40,50,90,.10); }
        .auth-kicker { font-size:11px; font-weight:800; letter-spacing:.18em; color:#6965e8; text-transform:uppercase; }
        .auth-card h1 { margin:10px 0 8px; font-size:30px; line-height:1.15; }
        .auth-subtitle { color:#64748b; margin:0 0 24px; line-height:1.6; }
        .auth-form { display:grid; gap:15px; }
        .auth-form label { display:grid; gap:7px; font-size:13px; font-weight:700; color:#334155; }
        .auth-form input { width:100%; box-sizing:border-box; padding:12px 13px; border:1px solid #cbd5e1; border-radius:10px; background:#fff; color:#0f172a; font:inherit; }
        .auth-submit,.auth-google { width:100%; min-height:45px; border-radius:11px; font-weight:750; cursor:pointer; transition:transform .18s ease, box-shadow .18s ease; }
        .auth-submit { color:white; border:0; background:linear-gradient(110deg,#615cf5,#8b5cf6); box-shadow:0 8px 18px rgba(99,91,245,.23); }
        .auth-google { color:#1e293b; border:1px solid #cbd5e1; background:white; }
        .auth-submit:hover,.auth-google:hover { transform:translateY(-2px); box-shadow:0 10px 24px rgba(60,60,100,.15); }
        .auth-submit:disabled,.auth-google:disabled { opacity:.6; cursor:wait; }
        .auth-divider { display:flex; align-items:center; gap:12px; color:#94a3b8; font-size:12px; margin:18px 0; }
        .auth-divider:before,.auth-divider:after { content:''; height:1px; background:#e2e8f0; flex:1; }
        .auth-switch { margin-top:20px; text-align:center; color:#64748b; font-size:13px; }
        .auth-link { color:#5b56df; background:none; border:0; cursor:pointer; font:inherit; font-weight:750; }
        .auth-alert { padding:11px 12px; border-radius:10px; font-size:13px; line-height:1.5; margin-bottom:14px; }
        .auth-alert-error { background:#fff1f2; color:#be123c; border:1px solid #fecdd3; }
        .auth-alert-success { background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; }
        .auth-small { font-size:12px; color:#94a3b8; line-height:1.5; margin-top:18px; text-align:center; }
        @media(max-width:520px){.auth-main{margin:32px auto}.auth-card{padding:24px}}
      `}</style>

      <header className="topbar">
        <a className="brand" href="#" onClick={event => event.preventDefault()}>
          Call<span>Pilot</span><i>.</i>
        </a>
        <span className="status">
          <span className="status-dot" /> Secure workspace
        </span>
      </header>

      <main className="auth-main">
        <section className="auth-card">
          <div className="auth-kicker">CALLPILOT WORKSPACE</div>

          <h1>
            {mode === 'signup'
              ? 'Create your account.'
              : mode === 'reset'
                ? 'Reset your password.'
                : 'Welcome back.'}
          </h1>

          <p className="auth-subtitle">
            {mode === 'signup'
              ? 'Create a secure account to keep your call history in one place.'
              : mode === 'reset'
                ? 'Enter your email and we’ll send instructions to reset your password.'
                : 'Sign in to continue to your sales workspace.'}
          </p>

          {error && (
            <div className="auth-alert auth-alert-error" role="alert">
              {error}
            </div>
          )}

          {notice && (
            <div className="auth-alert auth-alert-success" role="status">
              {notice}
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            <label>
              Email address
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
              />
            </label>

            {mode !== 'reset' && (
              <label>
                Password
                <input
                  type="password"
                  autoComplete={
                    mode === 'signup' ? 'new-password' : 'current-password'
                  }
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  placeholder={
                    mode === 'signup' ? 'At least 6 characters' : 'Your password'
                  }
                  minLength={6}
                  required
                />
              </label>
            )}

            <button className="auth-submit" type="submit" disabled={busy}>
              {busy
                ? 'Please wait…'
                : mode === 'signup'
                  ? 'Create account'
                  : mode === 'reset'
                    ? 'Send reset link'
                    : 'Sign in'}
            </button>
          </form>

          {mode !== 'reset' && (
            <>
              <div className="auth-divider">OR CONTINUE WITH</div>
              <button
                className="auth-google"
                type="button"
                onClick={signInWithGoogle}
                disabled={busy}
              >
                Continue with Google
              </button>
            </>
          )}

          <div className="auth-switch">
            {mode === 'login' && (
              <>
                <button
                  className="auth-link"
                  type="button"
                  onClick={() => {
                    setMode('reset')
                    setError('')
                    setNotice('')
                  }}
                >
                  Forgot password?
                </button>

                <div style={{ marginTop: 14 }}>
                  New to CallPilot?{' '}
                  <button
                    className="auth-link"
                    type="button"
                    onClick={() => {
                      setMode('signup')
                      setError('')
                      setNotice('')
                    }}
                  >
                    Create an account
                  </button>
                </div>
              </>
            )}

            {mode === 'signup' && (
              <>
                Already have an account?{' '}
                <button
                  className="auth-link"
                  type="button"
                  onClick={() => {
                    setMode('login')
                    setError('')
                    setNotice('')
                  }}
                >
                  Sign in
                </button>
              </>
            )}

            {mode === 'reset' && (
              <>
                Remembered it?{' '}
                <button
                  className="auth-link"
                  type="button"
                  onClick={() => {
                    setMode('login')
                    setError('')
                    setNotice('')
                  }}
                >
                  Back to sign in
                </button>
              </>
            )}
          </div>

          <p className="auth-small">
            Your call records are associated with your signed-in account.
          </p>
        </section>
      </main>
    </div>
  )
}

function App() {
  const [theme, setTheme] = useState('light')
  const [activePage, setActivePage] = useState('dashboard')
  const [activeStage, setActiveStage] = useState(null)
  const [callStarted, setCallStarted] = useState(false)
  const [callStartedAt, setCallStartedAt] = useState(null)
  const [editingCallId, setEditingCallId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [selectedStageActions, setStageActions] = useState(Array(8).fill(''))
  const [calls, setCalls] = useState([])
  const [isLoadingCalls, setIsLoadingCalls] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('success')
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [usernameDraft, setUsernameDraft] = useState('')
  const [isSavingUsername, setIsSavingUsername] = useState(false)
  const [openFaq, setOpenFaq] = useState(null)
  const [draftReadyUserId, setDraftReadyUserId] = useState(null)
  const [historySearch, setHistorySearch] = useState('')
  const [historyOutcome, setHistoryOutcome] = useState('all')
  const [historyDateFrom, setHistoryDateFrom] = useState('')
  const [historyDateTo, setHistoryDateTo] = useState('')
  const [historySort, setHistorySort] = useState('newest')
  const [isSuggestingStage, setIsSuggestingStage] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState(null)
  const [aiSuggestionError, setAiSuggestionError] = useState('')

  useEffect(() => {
    let alive = true

    supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return
      if (error) showAuthError(error.message)
      setSession(data?.session ?? null)
      setAuthReady(true)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession)
        setAuthReady(true)
      },
    )

    return () => {
      alive = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const username =
    session?.user?.user_metadata?.username ||
    session?.user?.user_metadata?.full_name ||
    session?.user?.user_metadata?.name ||
    session?.user?.email?.split('@')[0] ||
    'User'

  useEffect(() => {
    setUsernameDraft(session?.user?.user_metadata?.username || '')
  }, [session?.user?.id, session?.user?.user_metadata?.username])

  // Restore an unfinished call for this signed-in user from this browser.
  useEffect(() => {
    const userId = session?.user?.id
    setDraftReadyUserId(null)
    if (!userId) return

    try {
      const savedDraft = window.localStorage.getItem(`callpilot-draft-${userId}`)
      if (savedDraft) {
        const parsedDraft = JSON.parse(savedDraft)
        if (
          parsedDraft &&
          typeof parsedDraft === 'object' &&
          Array.isArray(parsedDraft.stageNotes)
        ) {
          setForm({
            prospect: parsedDraft.prospect || '',
            company: parsedDraft.company || '',
            stageNotes: Array.from({ length: 8 }, (_, index) =>
              typeof parsedDraft.stageNotes[index] === 'string'
                ? parsedDraft.stageNotes[index]
                : '',
            ),
            outcome: parsedDraft.outcome || '',
          })
          setStageActions(
            Array.from({ length: 8 }, (_, index) =>
              typeof parsedDraft.stageActions?.[index] === 'string'
                ? parsedDraft.stageActions[index]
                : '',
            ),
          )
          setActivePage('new-call')
          setCallStarted(true)
          setActiveStage(
            Number.isInteger(parsedDraft.activeStage)
              ? Math.max(0, Math.min(7, parsedDraft.activeStage))
              : 0,
          )
          setMessage('Your unfinished call draft has been restored.')
          setMessageType('success')
        } else {
          window.localStorage.removeItem(`callpilot-draft-${userId}`)
        }
      }
    } catch {
      // Ignore an unreadable local draft without interrupting sign-in.
    }
    setDraftReadyUserId(userId)
  }, [session?.user?.id])

  // Keep the unfinished draft separate from completed call records.
  useEffect(() => {
    const userId = session?.user?.id
    if (!userId || draftReadyUserId !== userId || !callStarted || editingCallId) return

    try {
      const hasDraftContent =
        form.prospect.trim() ||
        form.company.trim() ||
        form.outcome ||
        form.stageNotes.some(note => note.trim()) ||
        selectedStageActions.some(action => action)

      if (hasDraftContent) {
        window.localStorage.setItem(
          `callpilot-draft-${userId}`,
          JSON.stringify({ ...form, activeStage, stageActions: selectedStageActions }),
        )
      } else {
        window.localStorage.removeItem(`callpilot-draft-${userId}`)
      }
    } catch {
      // The call form still works if browser storage is unavailable.
    }
  }, [form, activeStage, selectedStageActions, callStarted, editingCallId, session?.user?.id, draftReadyUserId])

  async function saveUsername(event) {
    event.preventDefault()

    const cleanedUsername = usernameDraft.trim()

    if (!cleanedUsername) {
      showMessage('Please enter a username.', 'error')
      return
    }

    if (cleanedUsername.length > 30) {
      showMessage('Username must be 30 characters or fewer.', 'error')
      return
    }

    setIsSavingUsername(true)
    setMessage('')

    try {
      const { data, error } = await supabase.auth.updateUser({
        data: { username: cleanedUsername },
      })

      if (error) throw error

      if (data?.user) {
        setSession(previous =>
          previous ? { ...previous, user: data.user } : previous,
        )
      }

      showMessage('Username updated successfully.')
    } catch (error) {
      showMessage(`Could not update username: ${error.message}`, 'error')
    } finally {
      setIsSavingUsername(false)
    }
  }

  async function authFetch(url, options = {}) {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token

    if (!token) {
      throw new Error('Your session has expired. Please sign in again.')
    }

    return fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    })
  }

  useEffect(() => {
    let cancelled = false

    async function loadCalls() {
      if (!authReady) return

      if (!session) {
        setCalls([])
        setIsLoadingCalls(false)
        return
      }

      setIsLoadingCalls(true)

      try {
        const response = await authFetch(`${API_URL}/calls`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Could not load saved calls.')
        }

        if (!cancelled) {
          setCalls(Array.isArray(data) ? data : [])
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(`Could not load call history: ${error.message}`)
          setMessageType('error')
        }
      } finally {
        if (!cancelled) setIsLoadingCalls(false)
      }
    }

    loadCalls()

    return () => {
      cancelled = true
    }
  }, [session, authReady])

  function showMessage(text, type = 'success') {
    setMessage(text)
    setMessageType(type)
  }

  function startCall() {
    setEditingCallId(null)
    setForm(emptyForm())
    setStageActions(Array(8).fill(''))
    setActiveStage(0)
    setActivePage('new-call')
    setMessage('')
    setActiveStage(previous => previous ?? 0)
    setCallStartedAt(Date.now())
    setCallStarted(true)
  }

  function discardDraft() {
    setEditingCallId(null)
    try {
      if (session?.user?.id) {
        window.localStorage.removeItem(`callpilot-draft-${session.user.id}`)
      }
    } catch {
      // Ignore storage errors; clear the in-memory draft regardless.
    }
    setForm(emptyForm())
    setStageActions(Array(8).fill(''))
    setActiveStage(0)
    setCallStartedAt(Date.now())
    setCallStarted(true)
    showMessage('Draft cleared. You can start a fresh call.', 'success')
  }

  
  function reopenCall(call) {
    const restoredNotes = Array.from({ length: 8 }, () => '')
    const restoredActions = Array(8).fill('')

    for (const stageRecord of call.stages || []) {
      const index = Number(stageRecord.stage_number) - 1
      if (index < 0 || index > 7) continue

      const savedText = typeof stageRecord.prospect_notes === 'string'
        ? stageRecord.prospect_notes
        : ''
      const actionMatch = savedText.match(/^\[What happened: ([^\]]+)\](?:\nProspect’s words:([\s\S]*))?$/)

      if (actionMatch) {
        restoredActions[index] = actionMatch[1].trim()
        restoredNotes[index] = (actionMatch[2] || '').trim()
      } else {
        restoredNotes[index] = savedText
      }
    }

    setEditingCallId(call.id)
    setForm({
      prospect: call.prospect || '',
      company: call.company || '',
      outcome: call.outcome || '',
      stageNotes: restoredNotes,
      followUpDate: call.follow_up_date || '',
      followUpStatus: call.follow_up_status || 'Pending',
    })
    setStageActions(restoredActions)
    setActiveStage(Math.max(0, Math.min(7, (Number(call.stage_reached) || 1) - 1)))
    setCallStartedAt(null)
    setCallStarted(true)
    setActivePage('new-call')
    setAiSuggestion(null)
    setAiSuggestionError('')
    setMessage('')
  }

  function exportCallsCsv() {
    if (!calls.length) {
      showMessage('There are no saved calls to export.', 'error')
      return
    }

    const headers = ['Prospect', 'Company', 'Outcome', 'Created At']

    const rows = calls.map(call => [
      call.prospect || '',
      call.company || '',
      call.outcome || '',
      call.created_at || call.date || '',
    ])

    const escapeCsv = value => {
      const text = String(value ?? '')
      return `"${text.replace(/"/g, '""')}"`
    }

    const csv = [headers, ...rows]
      .map(row => row.map(escapeCsv).join(','))
      .join('\r\n')

    const blob = new Blob(['\uFEFF', csv], {
      type: 'text/csv;charset=utf-8;',
    })

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = `callpilot-calls-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`

    document.body.appendChild(link)
    link.click()
    link.remove()

    window.setTimeout(() => URL.revokeObjectURL(url), 1000)

    showMessage(
      `Exported ${calls.length} call${calls.length === 1 ? '' : 's'} to CSV.`,
    )
  }

  function updateField(event) {
    const { name, value } = event.target

    if (name === 'notes') {
      setForm(previous => ({
        ...previous,
        stageNotes: previous.stageNotes.map((note, index) =>
          index === activeStage ? value : note,
        ),
      }))
    } else {
      setForm(previous => ({ ...previous, [name]: value }))
    }
  }

  async function suggestNextStage() {
    const stageIndex = activeStage ?? 0
    const prospectWords = form.stageNotes[stageIndex]?.trim()
    const selectedAction = selectedStageActions[stageIndex]

    if (!prospectWords && !selectedAction) {
      setAiSuggestionError("First enter the prospect's exact words or select what happened in this stage.")
      setAiSuggestion(null)
      return
    }

    setIsSuggestingStage(true)
    setAiSuggestionError('')
    setAiSuggestion(null)

    try {
      const response = await authFetch(`${API_URL}/ai/suggest-stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentStage: stageIndex + 1,
          prospectWords: [
            selectedAction ? `What happened: ${selectedAction}` : '',
            prospectWords ? `Prospect's exact words: ${prospectWords}` : '',
          ].filter(Boolean).join('\\n'),
          company: form.company.trim(),
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Could not generate an AI suggestion.')
      }

      setAiSuggestion(data)
    } catch (error) {
      setAiSuggestionError(error.message || 'Could not generate an AI suggestion. Please try again.')
    } finally {
      setIsSuggestingStage(false)
    }
  }

  async function saveCall() {
    if (!form.prospect.trim()) {
      showMessage('Please enter the prospect name.', 'error')
      return
    }

    if (!form.outcome) {
      showMessage('Please select the call outcome.', 'error')
      return
    }

    setIsSaving(true)
    setMessage('')

    try {
      const response = await authFetch(editingCallId ? `${API_URL}/calls/${editingCallId}` : `${API_URL}/calls`, {
        method: editingCallId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospect: form.prospect.trim(),
          company: form.company.trim(),
          outcome: form.outcome,
          stageReached: (activeStage ?? 0) + 1,
          followUpDate: form.followUpDate || null,
          followUpStatus: form.followUpDate ? form.followUpStatus : null,
          ...(editingCallId ? {} : { durationSeconds: Math.max(0, Math.floor((Date.now() - (callStartedAt || Date.now())) / 1000)) }),
          stageNotes: form.stageNotes.map((note, index) => {
            const action = selectedStageActions[index]
            return action
              ? `[What happened: ${action}]${note.trim() ? `\nProspect’s words: ${note.trim()}` : ''}`
              : note
          }),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Unable to save this call.')
      }

      const historyResponse = await authFetch(`${API_URL}/calls`)

      if (historyResponse.ok) {
        const history = await historyResponse.json()
        setCalls(Array.isArray(history) ? history : [data.call])
      } else {
        setCalls(previous => [data.call, ...previous])
      }

      const wasEditing = Boolean(editingCallId)
      if (!wasEditing) {
        try {
          window.localStorage.removeItem(`callpilot-draft-${session.user.id}`)
        } catch {
          // The completed call is already saved on the server.
        }
      }
      setEditingCallId(null)
      setCallStarted(false)
      setCallStartedAt(null)
      setActivePage('dashboard')
      setForm(emptyForm())
      setStageActions(Array(8).fill(''))
      setActiveStage(null)
      showMessage(wasEditing ? 'Call updated successfully.' : 'Call saved successfully to your account.')
    } catch (error) {
      showMessage(`Could not save the call: ${error.message}`, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()

    if (error) {
      showMessage(error.message, 'error')
    } else {
      setCalls([])
      setCallStarted(false)
      setCallStartedAt(null)
      setActiveStage(null)
      setActivePage('dashboard')
      showMessage('You have signed out.')
    }
  }

  function goToStage(index) {
    setActiveStage(Math.max(0, Math.min(7, index)))
    setAiSuggestion(null)
    setAiSuggestionError('')
  }

  const meetingsBooked = calls.filter(
    call => call.outcome === 'Meeting booked',
  ).length

  const conversionRate = calls.length
    ? Math.round((meetingsBooked / calls.length) * 100)
    : 0

  const callsWithDuration = calls.filter(
    call => Number.isFinite(Number(call.duration_seconds)) && Number(call.duration_seconds) >= 0,
  )
  const averageCallDurationSeconds = callsWithDuration.length
    ? Math.round(
        callsWithDuration.reduce((total, call) => total + Number(call.duration_seconds), 0) /
          callsWithDuration.length,
      )
    : null
  const averageCallDurationLabel = averageCallDurationSeconds == null
    ? '—'
    : `${Math.floor(averageCallDurationSeconds / 60)}m ${String(averageCallDurationSeconds % 60).padStart(2, '0')}s`

  const todayKey = (() => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  })()
  const followUpCalls = calls
    .filter(call => Boolean(call.follow_up_date) && (call.follow_up_status || 'Pending') === 'Pending')
    .sort((a, b) => String(a.follow_up_date).localeCompare(String(b.follow_up_date)))
  const overdueFollowUps = followUpCalls.filter(call => call.follow_up_date < todayKey)
  const dueTodayFollowUps = followUpCalls.filter(call => call.follow_up_date === todayKey)
  const upcomingFollowUps = followUpCalls.filter(call => call.follow_up_date >= todayKey)

  const filteredCalls = calls
    .filter(call => {
      const query = historySearch.trim().toLowerCase()
      const matchesSearch =
        !query ||
        String(call.prospect || '').toLowerCase().includes(query) ||
        String(call.company || '').toLowerCase().includes(query)

      const matchesOutcome =
        historyOutcome === 'all' || call.outcome === historyOutcome

      const rawDate = call.created_at || call.date
      const callDate = rawDate ? new Date(rawDate) : null
      const validCallDate = callDate && !Number.isNaN(callDate.getTime())
      const callDay = validCallDate
        ? `${callDate.getFullYear()}-${String(callDate.getMonth() + 1).padStart(2, '0')}-${String(callDate.getDate()).padStart(2, '0')}`
        : ''

      const matchesDateFrom = !historyDateFrom || (callDay && callDay >= historyDateFrom)
      const matchesDateTo = !historyDateTo || (callDay && callDay <= historyDateTo)

      return (
        matchesSearch &&
        matchesOutcome &&
        matchesDateFrom &&
        matchesDateTo
      )
    })
    .sort((first, second) => {
      const firstDate = new Date(first.created_at || first.date || 0).getTime() || 0
      const secondDate = new Date(second.created_at || second.date || 0).getTime() || 0
      const firstStage = Number(first.stage_reached) || 0
      const secondStage = Number(second.stage_reached) || 0

      if (historySort === 'oldest') return firstDate - secondDate
      if (historySort === 'stage-high') return secondStage - firstStage || secondDate - firstDate
      if (historySort === 'stage-low') return firstStage - secondStage || secondDate - firstDate
      return secondDate - firstDate
    })

  const lastSevenDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - (6 - index))
    const nextDate = new Date(date)
    nextDate.setDate(nextDate.getDate() + 1)
    const count = calls.filter(call => {
      const rawDate = call.created_at || call.date
      if (!rawDate) return false
      const callDate = new Date(rawDate)
      return !Number.isNaN(callDate.getTime()) &&
        callDate >= date && callDate < nextDate
    }).length
    return {
      label: date.toLocaleDateString(undefined, { weekday: 'short' }),
      dateLabel: date.toLocaleDateString(),
      count,
    }
  })
  const weeklyMax = Math.max(1, ...lastSevenDays.map(day => day.count))
  const outcomeCounts = [
    'Meeting booked',
    'Follow-up required',
    'Interested',
    'Not interested',
    'No answer',
  ].map(outcome => ({
    outcome,
    count: calls.filter(call => call.outcome === outcome).length,
  }))
  const outcomeMax = Math.max(1, ...outcomeCounts.map(item => item.count))

  if (!authReady) {
    return (
      <div
        className="app light-theme"
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        Loading secure workspace…
      </div>
    )
  }

  if (!session) return <AuthScreen />

  return (
    <div className={`app ${theme}-theme`}>
      <header className="topbar">
        <a
          className="brand"
          href="#"
          onClick={event => {
            event.preventDefault()
            setActivePage('dashboard')
            setCallStarted(false)
            setActiveStage(null)
          }}
        >
          Call<span>Pilot</span><i>.</i>
        </a>

        <div className="header-actions">
          <span className="status">
            <span className="status-dot" /> Signed in
          </span>

          <span className="user-email" title={session.user.email}>
            {username}
          </span>

          <button
            className="theme-toggle"
            type="button"
            onClick={() =>
              setTheme(previous => previous === 'light' ? 'dark' : 'light')
            }
          >
            <span className="theme-icon">
              {theme === 'light' ? '☾' : '☀'}
            </span>
            {theme === 'light' ? 'Dark mode' : 'Light mode'}
          </button>

          <button className="theme-toggle" type="button" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <div className="app-body">
        <aside className="app-sidebar" aria-label="Main navigation">
          <div className="sidebar-label">WORKSPACE</div>

          <button
            type="button"
            className={`sidebar-link ${
              activePage === 'dashboard' && !callStarted
                ? 'sidebar-link-active'
                : ''
            }`}
            onClick={() => {
              setActivePage('dashboard')
              setCallStarted(false)
              setActiveStage(null)
            }}
          >
            <span className="sidebar-icon">⌂</span>
            <span>Dashboard</span>
          </button>

          <button
            type="button"
            className={`sidebar-link ${
              activePage === 'new-call' || callStarted
                ? 'sidebar-link-active'
                : ''
            }`}
            onClick={startCall}
          >
            <span className="sidebar-icon">＋</span>
            <span>New Call</span>
          </button>

          <button
            type="button"
            className={`sidebar-link ${
              activePage === 'history' && !callStarted
                ? 'sidebar-link-active'
                : ''
            }`}
            onClick={() => {
              setActivePage('history')
              setCallStarted(false)
              setActiveStage(null)
            }}
          >
            <span className="sidebar-icon">◷</span>
            <span>Call History</span>
            <span className="sidebar-count">{calls.length}</span>
          </button>

          <button
            type="button"
            className={`sidebar-link ${
              activePage === 'settings' && !callStarted
                ? 'sidebar-link-active'
                : ''
            }`}
            onClick={() => {
              setActivePage('settings')
              setCallStarted(false)
              setActiveStage(null)
            }}
          >
            <span className="sidebar-icon">⚙</span>
            <span>Settings</span>
          </button>

          <div className="sidebar-bottom">
            <div className="sidebar-user">
              <span className="sidebar-user-avatar">
                {username.charAt(0).toUpperCase()}
              </span>

              <span className="sidebar-user-copy">
                <strong>{username}</strong>
                <small title={session.user.email}>{session.user.email}</small>
              </span>
            </div>

            <button
              type="button"
              className="sidebar-link sidebar-signout"
              onClick={signOut}
            >
              <span className="sidebar-icon">↪</span>
              <span>Sign out</span>
            </button>
          </div>
        </aside>

        <div className="app-main-content">
          {message && (
            <div
              className={`app-message ${
                messageType === 'error'
                  ? 'app-message-error'
                  : 'app-message-success'
              }`}
              role="status"
            >
              <span>{message}</span>
              <button
                type="button"
                onClick={() => setMessage('')}
                aria-label="Dismiss message"
              >
                ×
              </button>
            </div>
          )}

          {!callStarted && activePage === 'history' ? (
            <main className="dashboard page-history">
              <div className="eyebrow">YOUR ACTIVITY</div>
              <h1 className="page-title">
                Call History<span>.</span>
              </h1>
              <p className="welcome-description">
                Review the calls saved to your account.
              </p>

              <section className="workspace history-panel">
                <div className="section-heading">
                  <div>
                    <div className="eyebrow">SAVED CONVERSATIONS</div>
                    <h2>All calls</h2>
                  </div>
                  <span>{calls.length} saved</span>
                </div>

                <div className="history-tools">
                  <input
                    type="search"
                    value={historySearch}
                    onChange={event => setHistorySearch(event.target.value)}
                    placeholder="Search prospect or company"
                    aria-label="Search calls by prospect or company"
                  />
                  <select
                    value={historyOutcome}
                    onChange={event => setHistoryOutcome(event.target.value)}
                    aria-label="Filter calls by outcome"
                  >
                    <option value="all">All outcomes</option>
                    {['Meeting booked', 'Follow-up required', 'Interested', 'Not interested', 'No answer'].map(outcome => (
                      <option key={outcome} value={outcome}>{outcome}</option>
                    ))}
                  </select>
                  <label className="history-date-filter">
                    <span>From date</span>
                    <input
                      type="date"
                      value={historyDateFrom}
                      onChange={event => setHistoryDateFrom(event.target.value)}
                      aria-label="Filter calls from date"
                    />
                  </label>
                  <label className="history-date-filter">
                    <span>To date</span>
                    <input
                      type="date"
                      value={historyDateTo}
                      min={historyDateFrom || undefined}
                      onChange={event => setHistoryDateTo(event.target.value)}
                      aria-label="Filter calls to date"
                    />
                  </label>
                  <select
                    value={historySort}
                    onChange={event => setHistorySort(event.target.value)}
                    aria-label="Sort calls"
                  >
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="stage-high">Highest stage reached</option>
                    <option value="stage-low">Lowest stage reached</option>
                  </select>
                  <button className="secondary-button" type="button" onClick={exportCallsCsv} disabled={calls.length === 0}>
                    Export CSV
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => {
                      setHistorySearch('')
                      setHistoryOutcome('all')
                      setHistoryDateFrom('')
                      setHistoryDateTo('')
                      setHistorySort('newest')
                    }}
                  >
                    Clear filters
                  </button>
                </div>

                {isLoadingCalls ? (
                  <p className="empty-history">Loading saved calls…</p>
                ) : calls.length === 0 ? (
                  <p className="empty-history">
                    No saved calls yet. Start a new call to see it here.
                  </p>
                ) : filteredCalls.length === 0 ? (
                  <p className="empty-history">No calls match these search and filter settings.</p>
                ) : (
                  filteredCalls.map(call => (
                    <div className="history-row" key={call.id}>
                      <div className="history-avatar">
                        {(call.prospect || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="history-info">
                        <strong>{call.prospect}</strong>
                        <span>
                          {call.company || 'Company not provided'} ·{' '}
                          {formatCallDate(call)}
                        </span>
                        <span>
                          Stage reached: {call.stage_reached
                            ? `${call.stage_reached}. ${stages[call.stage_reached - 1]?.[0] || 'Unknown stage'}`
                            : 'Not recorded for this older call'}
                        </span>
                        <span>
                          Next step: {call.stages?.[6]?.prospect_notes?.trim()
                            ? call.stages[6].prospect_notes.replace(/^\[What happened: ([^\]]+)\]/, '$1').replace(/\nProspect’s words:/g, ' — Prospect said:')
                            : 'Not recorded'}
                        </span>
                      </div>
                      <div className="history-row-actions" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', marginLeft: 'auto', flexShrink: 0 }}>
                        <span className="history-outcome">{call.outcome}</span>
                        <button
                          className="secondary-button reopen-call-button"
                          type="button"
                          onClick={() => reopenCall(call)}
                        >
                          Reopen Call
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </section>
            </main>
          ) : !callStarted && activePage === 'settings' ? (
            <main className="dashboard page-settings">
              <div className="eyebrow">PREFERENCES</div>
              <h1 className="page-title">
                Settings<span>.</span>
              </h1>
              <p className="welcome-description">
                Manage your profile, workspace appearance, and help options.
              </p>

              <section className="workspace settings-card">
                <div className="settings-row">
                  <div>
                    <h2>Appearance</h2>
                    <p>Choose the theme for your workspace.</p>
                  </div>
                  <button
                    className="theme-toggle"
                    type="button"
                    onClick={() =>
                      setTheme(previous =>
                        previous === 'light' ? 'dark' : 'light',
                      )
                    }
                  >
                    <span className="theme-icon">
                      {theme === 'light' ? '☾' : '☀'}
                    </span>
                    {theme === 'light'
                      ? 'Switch to dark mode'
                      : 'Switch to light mode'}
                  </button>
                </div>

                <div className="settings-row settings-profile-row">
                  <div>
                    <h2>Profile</h2>
                    <p>Choose the name displayed in your workspace.</p>
                    <strong className="settings-email">
                      {session.user.email}
                    </strong>
                  </div>

                  <form className="username-form" onSubmit={saveUsername}>
                    <label htmlFor="username">Username</label>
                    <input
                      id="username"
                      name="username"
                      type="text"
                      value={usernameDraft}
                      onChange={event => setUsernameDraft(event.target.value)}
                      placeholder="Enter your username"
                      maxLength={30}
                      autoComplete="nickname"
                      required
                    />
                    <button
                      className="primary-button"
                      type="submit"
                      disabled={isSavingUsername}
                    >
                      {isSavingUsername ? 'Saving…' : 'Save username'}
                    </button>
                  </form>
                </div>

                <div className="settings-row">
                  <div>
                    <h2>Saved calls</h2>
                    <p>Your calls are stored in your account.</p>
                  </div>
                  <strong className="settings-call-count">
                    {calls.length}
                  </strong>
                </div>

                <div className="faq-section">
                  <div className="faq-heading">
                    <h2>Help &amp; Frequently Asked Questions</h2>
                    <p>
                      Quick answers to common questions about CallPilot.
                    </p>
                  </div>

                  <div className="faq-list">
                    {faqs.map((faq, index) => (
                      <div className="faq-item" key={faq.question}>
                        <button
                          className="faq-question"
                          type="button"
                          aria-expanded={openFaq === index}
                          onClick={() =>
                            setOpenFaq(previous =>
                              previous === index ? null : index,
                            )
                          }
                        >
                          <span>{faq.question}</span>
                          <span className="faq-toggle">
                            {openFaq === index ? '−' : '+'}
                          </span>
                        </button>

                        {openFaq === index && (
                          <p className="faq-answer">{faq.answer}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </main>
          ) : callStarted ? (
            <main className="dashboard call-workspace">
              <button
                className="back-button"
                type="button"
                onClick={() => {
                  setActivePage('dashboard')
                  setCallStarted(false)
                  setActiveStage(null)
                }}
              >
                ← Back to dashboard
              </button>

              <div className="eyebrow">LIVE CALL WORKSPACE</div>
              <h1 className="call-title">
                Guide the conversation<span>.</span>
              </h1>
              <p className="welcome-description">
                Use patterns from the 100-call transcript set. Record what actually happened, not what you hoped would happen.
              </p>

              <section className="workspace call-panel">
                <div className="call-panel-heading">
                  <h2>Prospect details</h2>
                  <div className="draft-actions">
                    <span className="draft-status">Draft saves automatically in this browser</span>
                    <button className="secondary-button" type="button" onClick={discardDraft}>Clear draft</button>
                  </div>
                </div>

                <div className="form-grid">
                  <label>
                    Prospect name *
                    <input
                      name="prospect"
                      value={form.prospect}
                      onChange={updateField}
                      placeholder="e.g. Alex Morgan"
                    />
                  </label>

                  <label>
                    Company
                    <input
                      name="company"
                      value={form.company}
                      onChange={updateField}
                      placeholder="e.g. Acme Solutions"
                    />
                  </label>
                </div>

                <div className="call-layout">
                  <div>
                    <h3>Call stages</h3>
                    <div className="call-stage-list">
                      {stages.map(([name], index) => (
                        <button
                          key={name}
                          type="button"
                          className={`call-stage ${
                            activeStage === index ? 'call-stage-active' : ''
                          } ${
                            activeStage > index ? 'call-stage-done' : ''
                          }`}
                          onClick={() => goToStage(index)}
                        >
                          <span>
                            {activeStage > index
                              ? '✓'
                              : String(index + 1).padStart(2, '0')}
                          </span>
                          {name}
                          {activeStage === index && (
                            <span className="stage-arrow">●</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="stage-detail">
                    <div className="eyebrow">
                      STAGE {String((activeStage ?? 0) + 1).padStart(2, '0')}{' '}
                      OF 08
                    </div>
                    <h2>{stages[activeStage ?? 0][0]}</h2>
                    <p>{stages[activeStage ?? 0][1]}</p>

                    <div className="prompt-card">
                      <strong>Try asking</strong>
                      <p>{prompts[activeStage ?? 0]}</p>
                    </div>

                    <div style={{ margin: '18px 0' }}>
                      <div className="eyebrow" style={{ marginBottom: 10 }}>PROSPECTS MAY SAY</div>
                      <div style={{ display: 'grid', gap: 8 }}>
                        {stageExamples[activeStage ?? 0].map(example => (
                          <div
                            key={example}
                            style={{
                            background: '#f8fafc',
                            color: '#111827',
                            WebkitTextFillColor: '#111827',
                            borderLeft: '2px solid var(--accent, #273cff)',
                            padding: '10px 12px',
                            lineHeight: 1.5,
                            fontSize: 13,
                          }}
                          >
                            {example}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="notes-label" style={{ display: 'block', marginBottom: 16 }}>
                      <div className="eyebrow" style={{ marginBottom: 10 }}>WHAT HAPPENED</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                        {stageActions[activeStage ?? 0].map(action => {
                          const selected = selectedStageActions[activeStage ?? 0] === action
                          return (
                            <button
                              key={action}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => setStageActions(previous => previous.map((value, index) => index === (activeStage ?? 0) ? (value === action ? '' : action) : value))}
                              style={{
                                minHeight: 42,
                                padding: '9px 10px',
                                border: `1px solid ${selected ? '#243cff' : 'var(--border, #cbd5e1)'}`,
                                background: selected ? '#243cff' : 'var(--surface, #fff)',
                                color: selected ? '#fff' : 'var(--text, #172033)',
                                font: 'inherit',
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: 'pointer',
                                textAlign: 'center',
                              }}
                            >
                              {action}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <label className="notes-label">
                      Prospect’s exact words
                      <textarea
                        key={activeStage}
                        name="notes"
                        value={form.stageNotes[activeStage ?? 0]}
                        onChange={updateField}
                        placeholder="Type the prospect’s own words. Keep it brief and factual..."
                        rows={4}
                      />
                    </label>

                    <div style={{ marginTop: 14 }}>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={suggestNextStage}
                        disabled={isSuggestingStage}
                      >
                        {isSuggestingStage ? 'Analysing prospect’s words…' : '✦ Get AI recommendation'}
                      </button>

                      {aiSuggestionError && (
                        <p role="alert" style={{ color: 'var(--danger, #dc2626)', marginTop: 10 }}>
                          {aiSuggestionError}
                        </p>
                      )}

                      {aiSuggestion && (
                        <section
                          aria-live="polite"
                          style={{
                            marginTop: 14,
                            padding: 16,
                            border: '1px solid var(--border, #cbd5e1)',
                            borderRadius: 14,
                            background: 'var(--surface)',
                            color: 'var(--text)',
                          }}
                        >
                          <div className="eyebrow">AI RECOMMENDATION</div>
                          <h3 style={{ margin: '8px 0' }}>
                            Stage {aiSuggestion.suggestedStageNumber}: {aiSuggestion.suggestedStage}
                          </h3>
                          <p><strong>Why:</strong> {aiSuggestion.reason}</p>
                          <p><strong>Suggested response:</strong> “{aiSuggestion.suggestedResponse}”</p>
                          <button
                            className="secondary-button"
                            type="button"
                            onClick={() => {
                              goToStage(aiSuggestion.suggestedStageNumber - 1)
                              setAiSuggestionError('')
                            }}
                          >
                            Go to recommended stage
                          </button>
                        </section>
                      )}
                    </div>

                    <div className="stage-navigation">
                      <button
                        className="secondary-button"
                        type="button"
                        disabled={activeStage === 0}
                        onClick={() => goToStage((activeStage ?? 0) - 1)}
                      >
                        ← Previous
                      </button>
                      <button
                        className="primary-button"
                        type="button"
                        onClick={() => goToStage((activeStage ?? 0) + 1)}
                      >
                        <span>
                          {activeStage === 7
                            ? 'Stay on final stage'
                            : 'Next stage'}
                        </span>
                        <span className="button-arrow">→</span>
                      </button>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => {
                          const outcomeSection = document.querySelector('.outcome-section');
                          outcomeSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          outcomeSection?.querySelector('select[name="outcome"]')?.focus({ preventScroll: true });
                        }}
                      >
                        End Call
                      </button>
                    </div>
                  </div>
                </div>

                <div className="outcome-section">
                  <h2>Call outcome</h2>
                  <label>
                    Select the final result *
                    <select
                      name="outcome"
                      value={form.outcome}
                      onChange={updateField}
                    >
                      <option value="">Choose an outcome</option>
                      <option value="Meeting booked">Meeting booked</option>
                      <option value="Follow-up required">
                        Follow-up required
                      </option>
                      <option value="Interested">Interested</option>
                      <option value="Not interested">Not interested</option>
                      <option value="No answer">No answer</option>
                    </select>
                  </label>

                  <div style={{ marginTop: 18, padding: 16, border: '1px solid var(--border, #cbd5e1)', borderRadius: 14 }}>
                    <h3 style={{ marginTop: 0, marginBottom: 12 }}>Schedule a follow-up (optional)</h3>
                    <label>
                      Follow-up date
                      <input
                        type="date"
                        name="followUpDate"
                        value={form.followUpDate}
                        min={todayKey}
                        onChange={event => setForm(previous => ({
                          ...previous,
                          followUpDate: event.target.value,
                          followUpStatus: event.target.value ? (previous.followUpStatus || 'Pending') : 'Pending',
                        }))}
                      />
                    </label>
                    <label style={{ marginTop: 12 }}>
                      Follow-up status
                      <select
                        name="followUpStatus"
                        value={form.followUpStatus}
                        onChange={event => setForm(previous => ({ ...previous, followUpStatus: event.target.value }))}
                        disabled={!form.followUpDate}
                      >
                        <option value="Pending">Pending</option>
                        <option value="Completed">Completed</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </label>
                    <p style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', marginBottom: 0 }}>
                      Choose a date if this prospect needs another contact. Leave it blank if no follow-up is planned.
                    </p>
                  </div>

                  <button
                    className="primary-button"
                    type="button"
                    onClick={saveCall}
                    disabled={isSaving}
                  >
                    <span>{isSaving ? (editingCallId ? 'Updating call…' : 'Saving call…') : (editingCallId ? 'Update Call' : 'Save Call')}</span>
                    <span className="button-arrow">
                      {isSaving ? '…' : '✓'}
                    </span>
                  </button>
                </div>
              </section>
            </main>
          ) : (
            <main className="dashboard">
              <section className="welcome">
                <div className="eyebrow">
                  <span /> YOUR SALES WORKSPACE
                </div>
                <h1>
                  Every call has a story.
                  <br />
                  <span className="gradient-text">Make yours count.</span>
                </h1>
                <p className="welcome-description">
                  Less time thinking about what to say. More time connecting
                  with people.
                </p>
                <button
                  className="primary-button"
                  type="button"
                  onClick={startCall}
                >
                  <span>+ Start a New Call</span>
                  <span className="button-arrow">→</span>
                </button>
                <div className="microcopy">
                  ✳ Your conversation, guided intelligently.
                </div>
              </section>

              <section className="stats">
                <article className="stat-card stat-violet">
                  <div className="stat-top">
                    Total Calls <span className="stat-icon">↗</span>
                  </div>
                  <h2>{calls.length}</h2>
                  <p>Your conversations</p>
                </article>
                <article className="stat-card stat-coral">
                  <div className="stat-top">
                    Meetings Booked <span className="stat-icon">◇</span>
                  </div>
                  <h2>{meetingsBooked}</h2>
                  <p>New opportunities</p>
                </article>
                <article className="stat-card stat-mint">
                  <div className="stat-top">
                    Conversion Rate <span className="stat-icon">％</span>
                  </div>
                  <h2>{conversionRate}%</h2>
                  <p>Calls resulting in meetings</p>
                </article>
                <article className="stat-card stat-violet">
                  <div className="stat-top">
                    Average Call Duration <span className="stat-icon">◷</span>
                  </div>
                  <h2>{averageCallDurationLabel}</h2>
                  <p>
                    {callsWithDuration.length
                      ? `Across ${callsWithDuration.length} timed call${callsWithDuration.length === 1 ? '' : 's'}`
                      : 'Available for calls saved from now on'}
                  </p>
                </article>
              </section>

              <section className="workspace follow-up-panel" style={{ marginBottom: 24 }}>
                <div className="section-heading">
                  <div>
                    <div className="eyebrow">SALES NEXT STEPS</div>
                    <h2>Follow-up management</h2>
                    <p>Scheduled callbacks and prospects that need attention.</p>
                  </div>
                  <span>{followUpCalls.length} pending</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 18 }}>
                  <div className="stat-card stat-coral">
                    <div className="stat-top">Overdue</div>
                    <h2>{overdueFollowUps.length}</h2>
                  </div>
                  <button
                    className="stat-card stat-mint"
                    type="button"
                    onClick={() => {
                      if (dueTodayFollowUps.length > 0) {
                        reopenCall(dueTodayFollowUps[0])
                      } else {
                        showMessage('There are no pending follow-ups due today.', 'success')
                      }
                    }}
                    disabled={dueTodayFollowUps.length === 0}
                    title={dueTodayFollowUps.length > 0 ? 'Open the pending call due today' : 'No pending calls due today'}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      cursor: dueTodayFollowUps.length > 0 ? 'pointer' : 'not-allowed',
                      font: 'inherit',
                      color: 'inherit',
                      border: '1px solid var(--border-color, #e8e3f2)',
                    }}
                  >
                    <div className="stat-top">Due today</div>
                    <h2>{dueTodayFollowUps.length}</h2>
                    {dueTodayFollowUps.length > 0 && <span style={{ fontSize: 12 }}>Click to open pending call</span>}
                  </button>
                  <div className="stat-card stat-violet">
                    <div className="stat-top">Upcoming</div>
                    <h2>{upcomingFollowUps.filter(call => call.follow_up_date > todayKey).length}</h2>
                  </div>
                </div>
                {followUpCalls.length === 0 ? (
                  <p className="empty-history">No pending follow-ups yet. Schedule a date when saving or reopening a call.</p>
                ) : (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {followUpCalls.slice(0, 6).map(call => (
                      <div key={call.id} className="history-row" style={{ alignItems: 'center' }}>
                        <div className="history-avatar">
                          {(call.prospect || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="history-info">
                          <strong>{call.prospect}</strong>
                          <span>{call.company || 'Company not provided'} · Follow-up: {call.follow_up_date}</span>
                          <span>
                            {call.follow_up_date < todayKey
                              ? 'Overdue'
                              : call.follow_up_date === todayKey
                                ? 'Due today'
                                : 'Upcoming'}
                          </span>
                        </div>
                        <div className="history-row-actions" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                          <span className="history-outcome">{call.outcome}</span>
                          <button
                            className="secondary-button"
                            type="button"
                            onClick={async () => {
                              try {
                                const response = await authFetch(`${API_URL}/calls/${call.id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    prospect: call.prospect,
                                    company: call.company || '',
                                    outcome: call.outcome,
                                    stageReached: Number(call.stage_reached) || 1,
                                    stageNotes: Array.from({ length: 8 }, (_, index) => {
                                      const record = (call.stages || []).find(stage => Number(stage.stage_number) === index + 1)
                                      return record?.prospect_notes || ''
                                    }),
                                    followUpDate: call.follow_up_date,
                                    followUpStatus: 'Completed',
                                  }),
                                })
                                const data = await response.json()
                                if (!response.ok) throw new Error(data.error || 'Could not complete follow-up.')
                                const historyResponse = await authFetch(`${API_URL}/calls`)
                                if (historyResponse.ok) setCalls(await historyResponse.json())
                                showMessage(`Follow-up for ${call.prospect} marked completed.`)
                              } catch (error) {
                                showMessage(error.message || 'Could not update follow-up.', 'error')
                              }
                            }}
                          >
                            Mark completed
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="analytics-grid">
                <article className="workspace analytics-card">
                  <div className="section-heading">
                    <div>
                      <div className="eyebrow">LAST 7 DAYS</div>
                      <h2>Call activity</h2>
                      <p>Saved calls by calendar day.</p>
                    </div>
                  </div>
                  <div className="weekly-chart" role="img" aria-label="Call activity for the last seven days">
                    {lastSevenDays.map(day => (
                      <div className="weekly-bar-column" key={day.dateLabel} title={`${day.dateLabel}: ${day.count} calls`}>
                        <strong>{day.count}</strong>
                        <div className="weekly-bar-track">
                          <span className="weekly-bar" style={{ height: `${day.count ? Math.max(8, (day.count / weeklyMax) * 100) : 0}%` }} />
                        </div>
                        <small>{day.label}</small>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="workspace analytics-card">
                  <div className="section-heading">
                    <div>
                      <div className="eyebrow">OUTCOME BREAKDOWN</div>
                      <h2>Call outcomes</h2>
                      <p>{calls.length} total saved calls</p>
                    </div>
                  </div>
                  <div className="outcome-chart">
                    {outcomeCounts.map(item => (
                      <div className="outcome-chart-row" key={item.outcome}>
                        <div className="outcome-chart-label">
                          <span>{item.outcome}</span><strong>{item.count}</strong>
                        </div>
                        <div className="outcome-bar-track">
                          <span style={{ width: `${(item.count / outcomeMax) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              </section>

              <section className="workspace">
                <div className="section-heading">
                  <div>
                    <div className="eyebrow">YOUR CONVERSATION ROADMAP</div>
                    <h2>
                      Call flow <span className="live-badge">8 STAGES</span>
                    </h2>
                    <p>A practical guide informed by the 100-call transcript set.</p>
                  </div>
                  <div className="roadmap-icon">✳</div>
                </div>

                <div className="stage-list">
                  {stages.map(([name, description], index) => (
                    <button
                      className={`stage ${
                        activeStage === index ? 'stage-active' : ''
                      }`}
                      key={name}
                      type="button"
                      onClick={() =>
                        setActiveStage(previous =>
                          previous === index ? null : index,
                        )
                      }
                    >
                      <span className="stage-number">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="stage-content">
                        <strong>{name}</strong>
                        {activeStage === index && (
                          <span className="stage-description">
                            {description}
                          </span>
                        )}
                      </span>
                      <span className="stage-arrow">
                        {activeStage === index ? '−' : '↗'}
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="workspace history-panel">
                <div className="section-heading">
                  <div>
                    <div className="eyebrow">YOUR ACTIVITY</div>
                    <h2>Recent calls</h2>
                  </div>
                  <div className="recent-actions">
                    <span>{calls.length} saved</span>
                    <button className="secondary-button" type="button" onClick={exportCallsCsv} disabled={calls.length === 0}>Export CSV</button>
                  </div>
                </div>

                {isLoadingCalls ? (
                  <p className="empty-history">Loading saved calls…</p>
                ) : calls.length === 0 ? (
                  <p className="empty-history">
                    Your saved calls will appear here. Start your first
                    conversation!
                  </p>
                ) : (
                  calls.map(call => (
                    <div className="history-row" key={call.id}>
                      <div className="history-avatar">
                        {(call.prospect || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="history-info">
                        <strong>{call.prospect}</strong>
                        <span>
                          {call.company || 'Company not provided'} ·{' '}
                          {formatCallDate(call)}
                        </span>
                        <span>
                          Stage reached: {call.stage_reached
                            ? `${call.stage_reached}. ${stages[call.stage_reached - 1]?.[0] || 'Unknown stage'}`
                            : 'Not recorded for this older call'}
                        </span>
                        <span>
                          Next step: {call.stages?.[6]?.prospect_notes?.trim()
                            ? call.stages[6].prospect_notes.replace(/^\[What happened: ([^\]]+)\]/, '$1').replace(/\nProspect’s words:/g, ' — Prospect said:')
                            : 'Not recorded'}
                        </span>
                      </div>
                      <div className="history-row-actions" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', marginLeft: 'auto', flexShrink: 0 }}>
                        <span className="history-outcome">{call.outcome}</span>
                        <button
                          className="secondary-button reopen-call-button"
                          type="button"
                          onClick={() => reopenCall(call)}
                        >
                          Reopen Call
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </section>

              <footer className="page-footer">
                Thoughtful conversations. Better outcomes.
              </footer>
            </main>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
