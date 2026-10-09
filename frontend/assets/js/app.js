/* CAMPUSLINK browser application: vanilla JavaScript, HTML and CSS. */
(() => {
  const app = document.getElementById('app');
  const state = { token: localStorage.getItem('campuslink_token') || '', user: null, profile: null, page: 'home', routeQuery: '', routeVersion: 0, routeHistory: [], currentRouteKey: '', skipRouteHistoryOnce: false, charts: {}, quiz: null, interview: null, chat: [], assistantMode: 'placement', assistantOpen: false, assistantBusy: false, assistantError: '', quickQuizOptions: null, skillRecommendations: null, navExpanded: {}, communicationCoach: { mode: 'daily', difficulty: 'beginner', active: false, busy: false, messages: [], turnCount: 0, corrections: [], vocabulary: [], error: '', report: null, reportError: '', lastRequest: '' }, passwordReset: { stage: 'email', email: '', resetToken: '', role: '', resendAt: 0 } };
  let quickQuizHydrated = false;
  let recoveryOtpInterval = null;
  document.documentElement.dataset.theme = localStorage.getItem('campuslink_theme') || 'dark';
  const roleNames = { STUDENT: 'Student', COMPANY: 'Recruiter', ADMIN: 'Placement Officer' };
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const organizationFieldForRole = role => role === 'STUDENT'
    ? { name: 'college_name', label: 'College Name', placeholder: 'Enter your college name', maxLength: 180 }
    : role === 'COMPANY'
      ? { name: 'company_name', label: 'Company Name', placeholder: 'Enter your company name', maxLength: 160 }
      : null;
  function syncOrganizationField(form, role) {
    const field = $('#organization-name-field', form);
    const label = $('#organization-name-label', form);
    const input = $('#organization-name', form);
    if (!field || !label || !input) return;
    const config = organizationFieldForRole(role);
    const nextName = config?.name || '';
    if (input.name !== nextName) input.value = '';
    field.hidden = !config;
    input.disabled = !config;
    input.name = nextName;
    input.required = Boolean(config);
    if (!config) {
      label.textContent = '';
      input.placeholder = '';
      return;
    }
    label.textContent = config.label;
    input.placeholder = config.placeholder;
    input.maxLength = config.maxLength;
  }
  const initials = name => String(name || '?').split(/\s+/).slice(0, 2).map(x => x[0] || '').join('').toUpperCase();
  const money = value => value ? `₹${esc(value)}` : 'Not disclosed';
  const dateText = value => value ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const api = async (path, options = {}) => {
    const headers = new Headers(options.headers || {});

    if (state.token) headers.set('Authorization', `Bearer ${state.token}`);

    const requestOptions = { ...options, headers };
    const body = options.body;
    if (body != null && typeof body === 'object' &&
        !(body instanceof FormData) && !(body instanceof Blob) &&
        !(body instanceof URLSearchParams) && !(body instanceof ArrayBuffer)) {
        if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
        requestOptions.body = JSON.stringify(body);
    }

    const apiOrigin = window.location.protocol === 'file:' ? 'http://127.0.0.1:5000' : window.location.origin;
    const url = `${apiOrigin}${path.startsWith('/api') ? path : '/api' + path}`;
    const response = await fetch(url, requestOptions);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        console.error('API ERROR:', response.status, data);
        throw new Error(data.error || `Request failed (${response.status})`);
    }

    return data;
};

  const toast = (message, kind = '') => {
    const region = $('#toast-region'); if (!region) return;
    const node = document.createElement('div'); node.className = `toast ${kind}`; node.textContent = message; region.appendChild(node);
    setTimeout(() => node.remove(), 3600);
  };
  const safe = async fn => { try { await fn(); } catch (error) { toast(error.message || 'Something went wrong', 'error'); } };
  const withButtonBusy = async (button, label, fn) => {
    const original = button?.innerHTML;
    if (button) { button.disabled = true; button.textContent = label; }
    try { return await fn(); }
    finally { if (button?.isConnected) { button.disabled = false; button.innerHTML = original; } }
  };
  const badge = value => {
    const s = String(value || 'Pending');
    const cls = /verified|joined|selected|offer|placed|completed/i.test(s) ? 'success' : /shortlisted|interview|assessment|review|pending|applied/i.test(s) ? 'warning' : /reject|suspicious|unverified/i.test(s) ? 'danger' : 'blue';
    return `<span class="badge ${cls}">${esc(s.replaceAll('_', ' '))}</span>`;
  };
  const heading = (title, subtitle, action = '') => `<div class="page-header"><div><h1>${esc(title)}</h1><p>${esc(subtitle || '')}</p></div>${action ? `<div class="header-actions">${action}</div>` : ''}</div>`;
  const routeKey = raw => {
    const [path, query = ''] = String(raw || '').replace(/^#/, '').split('?');
    const normalizedPath = state.user && path === 'home' ? 'dashboard' : (path || 'home');
    return `${normalizedPath}${query ? `?${query}` : ''}`;
  };
  function noteRouteVisit(raw = location.hash) {
    const next = routeKey(raw);
    if (!state.currentRouteKey) { state.currentRouteKey = next; return; }
    if (next === state.currentRouteKey) return;
    if (state.skipRouteHistoryOnce) {
      state.skipRouteHistoryOnce = false;
      state.currentRouteKey = next;
      return;
    }
    const previousPath = state.currentRouteKey.split('?')[0];
    const isAuthRoute = ['login', 'register', 'forgot-password'].includes(previousPath);
    if (!(state.user && isAuthRoute)) {
      state.routeHistory.push(state.currentRouteKey);
      if (state.routeHistory.length > 40) state.routeHistory.shift();
    }
    state.currentRouteKey = next;
  }
  function navigateBack() {
    const fallback = state.user ? 'dashboard' : 'home';
    const current = routeKey(location.hash);
    let destination = '';
    while (state.routeHistory.length && !destination) {
      const candidate = state.routeHistory.pop();
      const path = candidate.split('?')[0];
      if (candidate !== state.currentRouteKey && !(state.user && ['login', 'register', 'forgot-password'].includes(path))) {
        destination = candidate;
      }
    }
    destination ||= fallback;
    if (routeKey(destination) === current) destination = fallback;
    if (routeKey(destination) === current) return;
    state.skipRouteHistoryOnce = true;
    location.hash = destination;
    if (routeKey(location.hash) === current) {
      state.skipRouteHistoryOnce = false;
      state.currentRouteKey = routeKey(destination);
      state.routeQuery = destination.split('?')[1] || '';
      if (state.user) renderShell(state.currentRouteKey.split('?')[0]);
      else showLanding();
    }
  }
  const pageBackControl = () => `<div class="page-back-control"><button class="page-back-button" type="button" data-action="navigate-back"><span aria-hidden="true">←</span><span>Back</span></button></div>`;
  function addAuthPageBackControl() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'page-back-button auth-page-back';
    button.dataset.action = 'navigate-back';
    button.setAttribute('aria-label', 'Back to previous page');
    button.innerHTML = '<span aria-hidden="true">←</span><span>Back</span>';
    app.prepend(button);
  }
  const metric = (label, value, icon, tone = '') => `<article class="card metric-card"><div class="metric-top"><span>${esc(label)}</span><span class="metric-icon ${tone}">${esc(icon)}</span></div><div class="metric-value">${esc(value)}</div><div class="metric-foot">Updated from your CAMPUSLINK data</div></article>`;
  const empty = (title, copy, icon = 'CL') => `<div class="empty-state"><div class="empty-icon">${esc(icon)}</div><h3>${esc(title)}</h3><p>${esc(copy)}</p></div>`;
  const navLink = (label, icon, href, options = {}) => ({ kind: 'link', label, icon, href, action: options.action || '' });
  const navGroup = (key, label, icon, children, href = '') => ({ kind: 'group', key, label, icon, children, href });
  const navLabel = label => ({ kind: 'label', label });
  const navForRole = role => {
    const profileMenu = role === 'STUDENT' ? navGroup('profile', 'Profile', '♙', [
      navLink('Profile Overview', '◫', '#profile?section=overview'),
      navLink('Personal Information', '◎', '#profile?section=personal-information'),
      navLink('Academic Information', '▤', '#profile?section=academic-information'),
      navLink('Skills & Interests', '⌁', '#profile?section=skills'),
      navGroup('profile-portfolio', 'Career Portfolio', '▧', [
        navLink('Resume', '▧', '#resume'), navLink('Projects', '⌘', '#projects'), navLink('Certifications', '◇', '#certificates')
      ], '#profile'),
      navLink('Achievements', '✦', '#profile?section=achievements'),
      navLink('Profile Progress', '◉', '#profile?section=profile-completion'),
      navLink('Edit Profile', '✎', '#profile?section=edit-profile')
    ], '#profile') : role === 'COMPANY' ? navGroup('profile', 'Profile', '♙', [
      navLink('Company Profile', '◫', '#profile?section=overview'),
      navLink('Personal Information', '◎', '#profile?section=personal-information'), navLink('Edit Profile', '✎', '#profile?section=edit-profile')
    ], '#profile') : navGroup('profile', 'Account Recovery', '♙', [
      navLink('Recovery Overview', '◫', '#profile?section=overview'), navLink('Recovery Details', '▦', '#profile?section=date-of-birth')
    ], '#profile');

    const preparationMenu = navGroup('preparation', 'Preparation', '✦', [
      navLink('Preparation Dashboard', '▦', '#preparation'),
      navGroup('prep-resources', 'Learning Resources', '▷', [
        navGroup('prep-programming', 'Programming', '⌘', [
          navLink('Python', 'Py', '#resources?skill=Python'), navLink('Java', 'J', '#resources?skill=Java'),
          navLink('C / C++', 'C', '#resources?skill=C%2FC%2B%2B'), navLink('DSA', '⌘', '#resources?skill=DSA')
        ], '#resources'),
        navGroup('prep-web-data', 'Web & Data', '▤', [
          navLink('Web Development', '▣', '#resources?skill=Web%20Development'), navLink('Data Science', '▤', '#resources?skill=Data%20Science'),
          navLink('AI / ML', '✦', '#resources?skill=AI%2FML'), navLink('SQL / Database', '▧', '#resources?skill=SQL%2FDatabase')
        ], '#resources'),
        navLink('Communication Skills', '◉', '#resources?skill=Communication')
      ], '#resources'),
      navGroup('prep-practice-tests', 'Practice & Tests', '✓', [
        navLink('Coding Practice', '</>', '#quizzes?topic=programming'), navLink('Quick Quiz', '⚡', '#quizzes'),
        navLink('Aptitude Test', '◷', '#quizzes?category=Aptitude'), navLink('Branch-wise Quiz', '⌘', '#quizzes?mode=branch')
      ], '#quizzes'),
      navGroup('prep-interviews', 'Interview Practice', '◌', [
        navLink('HR Interview', '◎', '#interview?category=HR'), navLink('Technical Interview', '⌘', '#interview?category=Technical'),
        navLink('AI Interview Practice', '✦', '#chatbot?mode=mock_interview'), navLink('Communication Practice', '◉', '#communication?mode=daily')
      ], '#interview'),
      navLink('Placement Roadmap', '⌖', '#roadmap'), navLink('Progress Tracker', '▥', '#tracker'),
      navGroup('prep-career-readiness', 'Career Readiness', '✦', [
        navLink('Skill Recommendations', '⌁', '#recommendations'), navLink('Professional Readiness', '✦', '#readiness')
      ], '#readiness')
    ], '#preparation');

    const accountMenu = navGroup('account', 'Account', '◉', [
      navLink('Account Overview', '▦', '#account'),
      navGroup('account-settings', 'Settings & Privacy', '⚙', [
        navLink('General Settings', '⚙', '#account?section=general'), navLink('Password & Security', '▣', '#account?section=security'),
        navLink('Privacy & Data', '◉', '#account?section=privacy'), navLink('Appearance', '◐', '#account?section=appearance')
      ], '#account?section=general'),
      navLink('Notifications', '♧', '#notifications'),
      navGroup('account-help', 'Help & About', '?', [
        navLink('Help Center', '?', '#account?section=help'), navLink('Contact / Report a Problem', '✉', '#feedback'),
        navLink('About CAMPUSLINK', 'ⓘ', '#account?section=about')
      ], '#feedback')
    ], '#account');

    if (role === 'COMPANY') return [
      navLabel('Workspace'), navLink('Dashboard','▦','#dashboard'), profileMenu,
      navLink('My Vacancies','▤','#jobs'), navLink('Post a Vacancy','+','#create-job'), navLink('Candidates','◎','#candidates'), navLink('Hiring Analytics','↗','#analytics'), navLink('Calendar','□','#calendar'), accountMenu
    ];
    if (role === 'ADMIN') return [
      navLabel('Placement Office'), navLink('Dashboard','▦','#dashboard'), profileMenu,
      navLink('Students','♙','#students'), navLink('Companies','◉','#companies'), navLink('Vacancies','▤','#admin-jobs'), navLink('Applications','↗','#admin-applications'),
      navLink('Placements','✦','#placements'), navLink('Analytics','▥','#analytics'), navLink('Skill Demand','⌁','#skill-demand'), navLink('Certificates','◇','#certificates'), navLink('Evidence Review','✓','#evidence'), navLink('Feedback','✉','#feedback'), accountMenu
    ];
    return [
      navLabel('My Workspace'),
      navGroup('dashboard-home', 'Dashboard', '▦', [
        navLink('Overview', '▦', '#dashboard'),
        navGroup('dashboard-opportunities', 'Opportunities', '⌕', [
          navLink('Explore Jobs', '⌕', '#jobs'), navLink('Applications', '↗', '#applications')
        ], '#jobs'),
        navGroup('dashboard-activity', 'Activity & Tools', '◌', [
          navLink('Jarvis Assistant', '◌', '#chatbot'), navLink('Calendar & Reminders', '□', '#calendar'),
          navLink('Internships', '↗', '#internships')
        ], '#calendar')
      ], '#dashboard'),
      profileMenu, preparationMenu, accountMenu
    ];
  };
  const currentRoute = () => `${state.page}${state.routeQuery ? `?${state.routeQuery}` : ''}`;
  const routeMatches = href => !!href && href.replace(/^#/, '') === currentRoute();
  const nodeIsActive = node => node.kind === 'group'
    ? (node.key === 'profile' && state.page === 'profile') || (node.key === 'preparation' && state.page === 'preparation') || (node.key === 'account' && state.page === 'account') || routeMatches(node.href) || node.children.some(nodeIsActive)
    : routeMatches(node.href);
  function renderNavNode(node, depth = 0) {
    if (node.kind === 'label') return `<div class="nav-label">${esc(node.label)}</div>`;
    const active = nodeIsActive(node);
    if (node.kind === 'group') {
      const open = active || (state.navExpanded[node.key] ?? false);
      const trigger = node.href
        ? `<a class="nav-link nav-tree-link ${active ? 'nav-parent-active' : ''}" href="${esc(node.href)}" title="${esc(node.label)}"><span class="nav-icon">${esc(node.icon)}</span><span>${esc(node.label)}</span></a>`
        : `<span class="nav-link nav-tree-link ${active ? 'nav-parent-active' : ''}" title="${esc(node.label)}"><span class="nav-icon">${esc(node.icon)}</span><span>${esc(node.label)}</span></span>`;
      return `<div class="nav-tree-group depth-${Math.min(depth,3)} ${open?'is-open':''}" data-nav-group="${esc(node.key)}"><div class="nav-tree-heading">${trigger}<button class="nav-tree-toggle" type="button" data-action="toggle-nav-group" data-nav-key="${esc(node.key)}" aria-label="${open?'Collapse':'Expand'} ${esc(node.label)}" aria-expanded="${open}" aria-controls="nav-children-${esc(node.key)}"><span aria-hidden="true">⌄</span></button></div><div class="nav-children" id="nav-children-${esc(node.key)}" ${open?'':'inert'}><div class="nav-children-inner">${node.children.map(child=>renderNavNode(child,depth+1)).join('')}</div></div></div>`;
    }
    if (node.action) return `<button class="nav-link nav-action ${active?'active':''}" type="button" data-action="${esc(node.action)}"><span class="nav-icon">${esc(node.icon)}</span><span>${esc(node.label)}</span></button>`;
    return `<a class="nav-link nav-leaf depth-${Math.min(depth,3)} ${active?'active':''}" href="${esc(node.href)}" title="${esc(node.label)}" ${active?'aria-current="page"':''}><span class="nav-icon">${esc(node.icon)}</span><span>${esc(node.label)}</span></a>`;
  }

  function showLanding() {
    state.page = 'home';
    const foundationFeatures = [
      ['Certificate verification', 'Submit learning evidence and follow its review status.', '◇'],
      ['Quick skill quiz', 'Practice from your branch-aware question bank and track your results.', '✓'],
      ['Mock interview', 'Practice with local question banks and review clear feedback.', '◌'],
    ];
    const aiFeatures = [
      ['Resume analysis', 'Extract skills and resume sections locally, then see focused improvement suggestions.', '▤'],
      ['Profile-aware skill recommendations', 'Prioritize skills that appear in active vacancies and follow a practical learning path.', '⌁'],
      ['Jarvis AI assistant', 'Ask for branch-aware career, resume and interview guidance when the service is configured.', '✦'],
    ];
    const featureCards = items => items.map(([title, description, icon]) =>
      '<article class="feature-card"><div class="feature-icon">' + icon + '</div><h3>' + title + '</h3><p>' + description + '</p></article>'
    ).join('');
    const steps = [
      ['Build your profile', 'Add skills, projects, internships and certificates.'],
      ['Understand your strengths', 'Review profile evidence, resume signals and skill progress.'],
      ['Prepare with focus', 'Use a roadmap, quizzes and interview practice to improve.'],
      ['Apply with confidence', 'Explore relevant roles and follow application progress.'],
    ];
    const categories = ['Website', 'Resume Analysis', 'AI Matching', 'Chatbot', 'Interview', 'Jobs', 'Analytics', 'Other'];
    app.innerHTML = [
      '<div class="landing">',
      '<header class="public-nav"><a class="brand" href="#home" aria-label="CAMPUSLINK home"><span class="brand-mark">C</span><span>CAMPUSLINK<small>CAREER INTELLIGENCE</small></span></a><button class="public-menu-toggle" type="button" data-action="toggle-public-menu" aria-label="Open navigation" aria-controls="public-links" aria-expanded="false">☰</button><nav class="public-links" id="public-links" aria-label="Main navigation"><a href="#features">Features</a><a href="#how">How it works</a><a href="#placements">Placements</a><a href="#ai-tools">AI tools</a><a href="#contact">Contact</a><a class="mobile-login-menu" href="#login">Log in</a></nav><div class="header-actions"><button class="btn btn-secondary" data-action="login">Log in</button><button class="btn btn-primary" data-action="register">Get started <span>→</span></button></div></header>',
      '<main>',
      '<section class="hero hero-centered" aria-labelledby="hero-title"><div class="hero-copy-wrap"><span class="eyebrow hero-kicker"><i></i> AI-powered career readiness</span><h1 id="hero-title">Your AI Copilot for <span>Career &amp; Placement Success.</span></h1><p class="hero-copy">Analyze your skills, improve your resume, practice interviews, discover opportunities, and prepare for your dream career with AI.</p><div class="hero-actions"><button class="btn btn-primary" data-action="register">Start Your Journey <span>→</span></button><a class="btn btn-secondary" href="#features">Explore CAMPUSLINK</a></div><div class="hero-note"><span class="hero-note-mark">✦</span> One connected workspace for students, recruiters and placement teams</div></div>',
      '<div class="hero-stage" aria-label="CAMPUSLINK career tools"><div class="hero-glow" aria-hidden="true"></div><article class="hero-float hero-float-resume"><span class="hero-card-icon">▤</span><span><b>Resume insights</b><small>Skills and sections, clearly surfaced</small></span><i class="hero-status-dot"></i></article><article class="hero-float hero-float-skills"><span class="hero-card-icon">⌁</span><span><b>Skill analysis</b><small>Next steps from active role demand</small></span></article><article class="hero-float hero-float-interview"><span class="hero-card-icon">◌</span><span><b>Interview prep</b><small>Practice at your own pace</small></span></article><article class="hero-readiness"><div class="hero-readiness-orbit"><span>✦</span></div><span><b>Placement readiness</b><small>A transparent view of your progress</small></span></article></div><div class="hero-scroll-cue"><span></span> Explore the platform</div></section>',
      '<div class="trust-row"><strong>Designed around the whole placement journey</strong><span>STUDENT READINESS</span><span>RECRUITER WORKFLOWS</span><span>PLACEMENT INSIGHT</span></div>',
      '<section class="section feature-section" id="features"><div class="section-head"><span class="eyebrow">One connected career workspace</span><h2>Every step forward, in one place.</h2><p>Bring student evidence, opportunities and preparation together with clear, practical feedback.</p></div><div class="feature-grid">' + featureCards(foundationFeatures) + '</div><div class="section-head feature-subhead" id="ai-tools"><span class="eyebrow">AI tools for your next step</span><h2>Personal guidance, grounded in your profile.</h2></div><div class="feature-grid">' + featureCards(aiFeatures) + '</div></section>',
      '<section class="section placement-section" id="placements"><div class="placement-intro"><span class="eyebrow">From campus to career</span><h2>A clearer placement journey for everyone.</h2><p>Students build evidence. Recruiters find eligible candidates. Placement teams follow progress and outcomes.</p></div><div class="placement-roles"><article><span>01</span><h3>Student workspace</h3><p>Prepare your profile, discover roles and keep your next steps visible.</p></article><article><span>02</span><h3>Recruiter workspace</h3><p>Publish vacancies and review candidates against the criteria you set.</p></article><article><span>03</span><h3>Placement office</h3><p>Review activity, evidence and placement trends across your institution.</p></article></div></section>',
      '<section class="steps" id="how"><div class="section"><div class="section-head"><span class="eyebrow">How CAMPUSLINK works</span><h2>Move from profile to opportunity with context.</h2><p>Four practical steps connect preparation, discovery and placement.</p></div><div class="step-grid">' + steps.map(([title, description], i) => '<article class="step"><div class="step-number">' + String(i + 1).padStart(2, '0') + '</div><div><h3>' + title + '</h3><p class="muted">' + description + '</p></div></article>').join('') + '</div></div></section>',
      '<section class="section" id="contact"><div class="contact-panel"><div><span class="eyebrow">Start with your next step</span><h2>Your career workspace is ready when you are.</h2><p class="muted">Create a student or recruiter account to get started. Placement officer accounts are provisioned by an administrator.</p></div><div class="contact-actions"><button class="btn btn-primary" data-action="register">Create an account <span>→</span></button><button class="btn btn-secondary" data-action="login">Log in</button></div></div></section>',
      '<section class="section public-feedback" id="public-feedback"><div class="section-head"><span class="eyebrow">Help us improve</span><h2>Share feedback with CAMPUSLINK.</h2><p>Feedback can be sent without creating an account.</p></div><form class="card" data-form="feedback"><div class="form-grid"><div class="field"><label>Rating</label><select name="rating">' + [5, 4, 3, 2, 1].map(x => '<option value="' + x + '">' + '★'.repeat(x) + ' · ' + x + '/5</option>').join('') + '</select></div><div class="field"><label>Category</label><select name="category">' + categories.map(x => '<option>' + x + '</option>').join('') + '</select></div><div class="field full"><label>Your feedback</label><textarea name="message" required minlength="4" placeholder="What worked well, or what could be clearer?"></textarea></div></div><button class="btn btn-primary">Send feedback <span>→</span></button></form></section>',
      '</main><footer class="footer"><a class="brand" href="#home"><span class="brand-mark">C</span><span>CAMPUSLINK</span></a><div class="footer-meta"><a href="#public-feedback">Feedback</a><span>© ' + new Date().getFullYear() + ' CAMPUSLINK · Career intelligence</span></div></footer></div>',
    ].join('');
    const publicPath = location.hash.replace(/^#/, '').split('?')[0] || 'home';
    if (publicPath !== 'home') {
      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'page-back-button public-back-button';
      back.dataset.action = 'navigate-back';
      back.innerHTML = '<span aria-hidden="true">←</span><span>Back</span>';
      back.setAttribute('aria-label', 'Back to previous page');
      $('.public-nav')?.prepend(back);
    }
  }
  let passwordControlSequence = 0;
  function enhancePasswordInputs() {
    document.querySelectorAll('#app input[type="password"]').forEach(input => {
      if (input.dataset.passwordControl) return;
      if (!input.id) input.id = `password-control-${++passwordControlSequence}`;
      const control = document.createElement('div');
      control.className = 'password-control';
      input.parentElement.insertBefore(control, input);
      control.append(input);
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'password-toggle';
      toggle.dataset.action = 'toggle-password';
      toggle.dataset.target = input.id;
      toggle.setAttribute('aria-label', 'Show password');
      toggle.setAttribute('aria-pressed', 'false');
      toggle.textContent = 'Show';
      control.append(toggle);
      input.dataset.passwordControl = 'true';
    });
  }

  function showAuthRoleChoice(register = false) {
    const nextPath = register ? 'register' : 'login';
    app.innerHTML = `<div class="auth-wrap"><section class="auth-art"><a class="brand" href="#home"><span class="brand-mark">C</span><span>CAMPUSLINK<small>PLACEMENT INTELLIGENCE</small></span></a><div class="auth-quote"><span class="eyebrow">Campus to career</span><h2>One platform, a workspace for your role.</h2><p>Choose how you use CAMPUSLINK to continue to the right sign-in or account setup.</p></div><div class="auth-foot">Student and company accounts use their own tailored CAMPUSLINK workspace.</div></section><section class="auth-form-wrap"><div class="auth-role-picker"><a class="auth-back" href="#home">← Back to home</a><span class="eyebrow">Choose your workspace</span><h2>${register ? 'Create your account' : 'Welcome to CAMPUSLINK'}</h2><p class="auth-role-intro">Select your account type to continue.</p><div class="auth-role-grid"><a class="auth-role-card" href="#${nextPath}?role=STUDENT"><span class="auth-role-icon" aria-hidden="true">♙</span><span class="auth-role-copy"><b>Student</b><small>Prepare for placements, learn and apply for roles.</small></span><span class="auth-role-arrow" aria-hidden="true">→</span></a><a class="auth-role-card" href="#${nextPath}?role=COMPANY"><span class="auth-role-icon" aria-hidden="true">▣</span><span class="auth-role-copy"><b>Company</b><small>Publish opportunities and find eligible candidates.</small></span><span class="auth-role-arrow" aria-hidden="true">→</span></a></div>${register ? '' : '<p class="auth-admin-link"><a href="#login?role=ADMIN">Placement Officer sign in</a></p>'}<div class="auth-toggle">${register ? 'Already have an account?' : 'New to CAMPUSLINK?'} <a href="#${register ? 'login' : 'register'}">${register ? 'Sign in' : 'Create account'}</a></div></div></section></div>`;
    addAuthPageBackControl();
  }

  function showAuth(register = false, selectedRole = '') {
    const role = String(selectedRole || '').toUpperCase();
    if (!['STUDENT', 'COMPANY'].includes(role) && !(role === 'ADMIN' && !register)) {
      showAuthRoleChoice(register);
      return;
    }
    const roleLabel = role === 'COMPANY' ? 'Company' : role === 'ADMIN' ? 'Placement Officer' : 'Student';
    const emailPlaceholder = role === 'COMPANY' ? 'you@company.com' : 'you@college.edu';
    const formKind = register ? 'register' : 'login';
    const nameField = role === 'COMPANY' ? '' : '<div class="field"><label for="auth-name">Full name</label><input id="auth-name" name="name" required autocomplete="name" placeholder="Your name"></div>';
    app.innerHTML = `<div class="auth-wrap"><section class="auth-art"><a class="brand" href="#home"><span class="brand-mark">C</span><span>CAMPUSLINK<small>PLACEMENT INTELLIGENCE</small></span></a><div class="auth-quote"><span class="eyebrow">${roleLabel} workspace</span><h2>${role === 'COMPANY' ? 'Build your campus hiring pipeline.' : role === 'ADMIN' ? 'Support every placement journey.' : 'Clarity for your placement journey.'}</h2><p>${role === 'COMPANY' ? 'Share opportunities, set clear eligibility and connect with promising candidates.' : role === 'ADMIN' ? 'Manage campus activity, review outcomes and support students and recruiters.' : 'Build your profile, discover relevant roles and prepare for your next opportunity.'}</p></div><div class="auth-foot">Local matching and analysis · Your account data stays in your configured CAMPUSLINK database</div></section><section class="auth-form-wrap"><form class="auth-form" data-form="${formKind}" data-role="${role}"><a class="auth-back" href="#login">← Back · Change account type</a><span class="eyebrow">${register ? `Create a ${roleLabel.toLowerCase()} account` : `${roleLabel} sign in`}</span><h2>${register ? `Join as a ${roleLabel}` : `${roleLabel} login`}</h2><p>${register ? `Create your ${roleLabel.toLowerCase()} workspace to get started.` : `Sign in to your ${roleLabel.toLowerCase()} workspace.`}</p>
      <input type="hidden" name="role" value="${role}">
      ${register ? `${nameField}<div class="field" id="organization-name-field" hidden><label id="organization-name-label" for="organization-name"></label><input id="organization-name" name="college_name" maxlength="180" required placeholder="Enter your college name"></div><div class="field"><label>Email address</label><input name="email" type="email" required autocomplete="email" placeholder="${emailPlaceholder}"></div><div class="field"><label>Password</label><input name="password" type="password" required minlength="8" autocomplete="new-password" placeholder="At least 8 characters"></div>${role === 'COMPANY' ? '' : '<div class="field"><label>Phone number</label><input name="phone" type="tel" inputmode="numeric" autocomplete="tel" maxlength="10" minlength="10" pattern="[0-9]{10}" title="Enter exactly 10 digits" required placeholder="10-digit number"></div>'}` : `<div class="field"><label>Email address</label><input name="email" type="email" required autocomplete="username" placeholder="${emailPlaceholder}"></div><div class="field"><label>Password</label><input name="password" type="password" required autocomplete="current-password" placeholder="Your password"></div><div class="auth-forgot"><a href="#forgot-password?role=${encodeURIComponent(role)}">Forgot Password?</a></div>`}
      <button class="btn btn-primary" style="width:100%;padding:13px" type="submit">${register ? 'Create account' : 'Sign in'} <span>→</span></button>${role === 'ADMIN' ? '<p class="muted auth-admin-note">Placement Officer accounts are provisioned by an administrator.</p>' : ''}<div class="auth-toggle">${register ? 'Already have an account?' : 'New to CAMPUSLINK?'} ${role === 'ADMIN' ? '' : `<button type="button" data-action="${register ? 'login' : 'register'}" data-role="${role}">${register ? 'Sign in' : 'Create account'}</button>`}</div></form></section></div>`;
    addAuthPageBackControl();
    if (register) {
      const registrationForm = $('form[data-form="register"]');
      syncOrganizationField(registrationForm, role);
      if (role === 'STUDENT') {
        const dateOfBirth = document.createElement('div');
        dateOfBirth.className = 'field';
        dateOfBirth.innerHTML = '<label for="auth-date-of-birth">Date of birth <span class="muted">(optional, for account recovery)</span></label><input id="auth-date-of-birth" name="date_of_birth" type="date" autocomplete="off">';
        $('input[name="email"]', registrationForm)?.closest('.field')?.before(dateOfBirth);
      }
    }
    enhancePasswordInputs();
  }

  function showPasswordRecovery(stage = 'email', selectedRole = state.passwordReset.role) {
    const role = String(selectedRole || '').toUpperCase();
    if (['STUDENT', 'COMPANY', 'ADMIN'].includes(role)) state.passwordReset.role = role;
    if (recoveryOtpInterval) { clearInterval(recoveryOtpInterval); recoveryOtpInterval = null; }
    state.passwordReset.stage = stage;
    const content = stage === 'success'
      ? `<span class="eyebrow">Account recovery complete</span><h2>Password reset successfully.</h2><p>You can now sign in with your new password.</p><button class="btn btn-primary" style="width:100%;padding:13px" type="button" data-action="return-to-login">Return to Login <span>→</span></button>`
      : stage === 'password'
        ? `<a class="auth-back" href="#login?role=${encodeURIComponent(state.passwordReset.role || '')}">← Back to login</a><span class="eyebrow">Almost done</span><h2>Create a new password</h2><p>Set a new password with at least eight characters.</p><form class="auth-form" data-form="reset-password"><div class="field"><label for="reset-password">New password</label><input id="reset-password" name="password" type="password" minlength="8" autocomplete="new-password" required placeholder="At least 8 characters"></div><div class="field"><label for="reset-password-confirm">Confirm new password</label><input id="reset-password-confirm" name="confirm_password" type="password" minlength="8" autocomplete="new-password" required placeholder="Type it again"></div><button class="btn btn-primary" style="width:100%;padding:13px" type="submit">Save new password <span>→</span></button></form>`
        : !['STUDENT', 'COMPANY', 'ADMIN'].includes(role)
          ? `<a class="auth-back" href="#login">← Back to login</a><span class="eyebrow">Secure account recovery</span><h2>Choose your account type</h2><p>Select the account you need to recover.</p><div class="auth-role-grid"><a class="auth-role-card" href="#forgot-password?role=STUDENT"><span class="auth-role-icon" aria-hidden="true">♙</span><span class="auth-role-copy"><b>Student</b><small>Recover a student account.</small></span><span class="auth-role-arrow" aria-hidden="true">→</span></a><a class="auth-role-card" href="#forgot-password?role=COMPANY"><span class="auth-role-icon" aria-hidden="true">▣</span><span class="auth-role-copy"><b>Company</b><small>Recover a company account by email code.</small></span><span class="auth-role-arrow" aria-hidden="true">→</span></a></div><p class="auth-admin-link"><a href="#forgot-password?role=ADMIN">Placement Officer recovery</a></p>`
          : role === 'COMPANY' && stage === 'otp'
            ? `<a class="auth-back" href="#login?role=COMPANY">← Back to company login</a><span class="eyebrow">Company account recovery · Step 2 of 3</span><h2>Check your email</h2><p>Enter the 6-digit code sent to your registered email. It expires in 5 minutes.</p><div class="recovery-email-summary"><span>Email address</span><b>${esc(state.passwordReset.email || '')}</b><button class="btn-ghost" type="button" data-action="change-recovery-email">Change</button></div><form class="auth-form" data-form="company-recovery-otp"><div class="field"><label for="company-reset-otp">Email verification code</label><input id="company-reset-otp" name="otp" type="text" inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" autocomplete="one-time-code" required placeholder="Enter 6-digit code"></div><button class="btn btn-primary" style="width:100%;padding:13px" type="submit">Verify OTP <span>→</span></button></form><button class="btn-ghost" style="width:100%;margin-top:8px" type="button" data-action="resend-recovery-otp" disabled>Resend OTP (60s)</button><p id="recovery-resend-countdown" class="muted" style="text-align:center;font-size:.76rem;margin-top:7px">You can request another code after 60 seconds.</p>`
            : role === 'COMPANY'
              ? `<a class="auth-back" href="#login?role=COMPANY">← Back to company login</a><span class="eyebrow">Company account recovery · Step 1 of 3</span><h2>Reset your company password</h2><p>We’ll send a one-time code to the registered email address.</p><form class="auth-form" data-form="company-recovery-email"><div class="field"><label for="recovery-email">Company email address</label><input id="recovery-email" name="email" type="email" required autocomplete="email" value="${esc(state.passwordReset.email || '')}" placeholder="you@company.com"></div><button class="btn btn-primary" style="width:100%;padding:13px" type="submit">Send OTP <span>→</span></button></form>`
              : stage === 'verify'
                ? `<a class="auth-back" href="#login?role=${encodeURIComponent(role)}">← Back to login</a><span class="eyebrow">Account recovery · Step 2 of 2</span><h2>Verify your account</h2><p>Enter the first four letters of your registered name and your date of birth.</p><div class="recovery-email-summary"><span>Email address</span><b>${esc(state.passwordReset.email || '')}</b><button class="btn-ghost" type="button" data-action="change-recovery-email">Change</button></div><form class="auth-form" data-form="verify-recovery-details"><div class="field"><label for="reset-name-prefix">First 4 letters of registered name</label><input id="reset-name-prefix" name="name_prefix" type="text" minlength="4" maxlength="4" autocomplete="off" autocapitalize="none" required placeholder="For example, Jaya"></div><div class="field"><label for="reset-date-of-birth">Date of birth</label><input id="reset-date-of-birth" name="date_of_birth" type="date" autocomplete="off" required></div><button class="btn btn-primary" style="width:100%;padding:13px" type="submit">Verify <span>→</span></button></form>`
                : `<a class="auth-back" href="#login?role=${encodeURIComponent(role)}">← Back to login</a><span class="eyebrow">Account recovery · Step 1 of 2</span><h2>Enter your email</h2><p>Start with the email address registered to your CAMPUSLINK account.</p><form class="auth-form" data-form="recovery-email"><div class="field"><label for="recovery-email">Email address</label><input id="recovery-email" name="email" type="email" required autocomplete="email" value="${esc(state.passwordReset.email || '')}" placeholder="you@example.com"></div><button class="btn btn-primary" style="width:100%;padding:13px" type="submit">Continue <span>→</span></button></form>`;

    app.innerHTML = `<div class="auth-wrap"><section class="auth-art"><a class="brand" href="#home"><span class="brand-mark">C</span><span>CAMPUSLINK<small>PLACEMENT INTELLIGENCE</small></span></a><div class="auth-quote"><span class="eyebrow" style="color:#71d0c8">Secure account recovery</span><h2>Get back to your placement journey.</h2><p>${role === 'COMPANY' ? 'Verify your company email, then choose a new password.' : 'Verify your account details, then choose a new password.'}</p></div><div class="auth-foot">CAMPUSLINK will never display your existing password or date of birth.</div></section><section class="auth-form-wrap"><div class="auth-form">${content}</div></section></div>`;
    addAuthPageBackControl();
    enhancePasswordInputs();
    if (role === 'COMPANY' && stage === 'otp') {
      if (!state.passwordReset.resendAt) state.passwordReset.resendAt = Date.now() + 60000;
      const updateResendState = () => {
        const button = $('[data-action="resend-recovery-otp"]');
        const countdown = $('#recovery-resend-countdown');
        if (!button) { clearInterval(recoveryOtpInterval); recoveryOtpInterval = null; return; }
        const seconds = Math.max(0, Math.ceil((state.passwordReset.resendAt - Date.now()) / 1000));
        button.disabled = seconds > 0;
        button.textContent = seconds > 0 ? `Resend OTP (${seconds}s)` : 'Resend OTP';
        if (countdown) countdown.textContent = seconds > 0 ? `You can request another code in ${seconds} seconds.` : 'You can request a new code now.';
        if (!seconds) { clearInterval(recoveryOtpInterval); recoveryOtpInterval = null; }
      };
      updateResendState();
      if (state.passwordReset.resendAt > Date.now()) recoveryOtpInterval = setInterval(updateResendState, 1000);
    }
  }

  async function bootstrap() {
    const hash = location.hash.replace(/^#/, '') || 'home';
    const [initialPage, initialQuery = ''] = hash.split('?');
    state.currentRouteKey = routeKey(hash);
    state.routeQuery = initialQuery;
    if (state.token) {
      try { const me = await api('/auth/me'); state.user = me.user; state.profile = me.profile || null; restoreActiveQuiz(); renderAssistantWidget(); renderShell(initialPage === 'home' ? (state.quiz?.active?'quizzes':'dashboard') : initialPage); return; }
      catch { localStorage.removeItem('campuslink_token'); state.token = ''; }
    }
    renderAssistantWidget();
    if (initialPage === 'login' || initialPage === 'register') {
      const role = new URLSearchParams(initialQuery).get('role') || '';
      showAuth(initialPage === 'register', role);
    } else if (initialPage === 'forgot-password') {
      const requestedRole = (new URLSearchParams(initialQuery).get('role') || '').toUpperCase();
      const role = ['STUDENT', 'COMPANY', 'ADMIN'].includes(requestedRole) ? requestedRole : '';
      state.passwordReset = { stage: 'email', email: '', resetToken: '', role, resendAt: 0 };
      showPasswordRecovery('email', role);
    } else showLanding();
  }

  function renderShell(page) {
    state.page = page;
    const nav = navForRole(state.user.role);
    const navHtml = nav.map(item => renderNavNode(item)).join('');
    const collapsed = localStorage.getItem('campuslink_sidebar_collapsed') === 'true';
    const theme = localStorage.getItem('campuslink_theme') || 'dark';
    const mobileLinks = state.user.role === 'COMPANY'
      ? [['Dashboard','▦','#dashboard'],['Vacancies','▤','#jobs'],['Post','+','#create-job'],['Candidates','◎','#candidates'],['Account','◉','#account']]
      : state.user.role === 'ADMIN'
        ? [['Dashboard','▦','#dashboard'],['Students','♙','#students'],['Companies','◉','#companies'],['Analytics','↗','#analytics'],['Account','⚙','#account']]
        : [['Home','⌂','#dashboard'],['Jobs','⌕','#jobs'],['Prepare','▤','#preparation'],['Jarvis','✦','#chatbot'],['Profile','◉','#profile']];
    const mobileNav = mobileLinks.map(([label, icon, href]) => {
      const target = href.replace(/^#/, '').split('?')[0];
      const active = page === target || page.startsWith(`${target}/`);
      return `<a class="mobile-nav-link ${active ? 'active' : ''}" href="${href}" ${active ? 'aria-current="page"' : ''}><span aria-hidden="true">${icon}</span><small>${label}</small></a>`;
    }).join('');
    app.innerHTML = `<div class="app-shell ${collapsed ? 'sidebar-collapsed' : ''}"><aside class="sidebar" id="sidebar"><div class="sidebar-brand-row"><a class="brand" href="#dashboard"><span class="brand-mark">C</span><span>CAMPUSLINK<small>PLACEMENT INTELLIGENCE</small></span></a><button class="sidebar-collapse" type="button" data-action="toggle-sidebar" aria-label="${collapsed ? 'Expand' : 'Collapse'} sidebar" aria-expanded="${!collapsed}"><span aria-hidden="true">${collapsed ? '»' : '«'}</span></button></div><nav class="side-nav" aria-label="Workspace navigation">${navHtml}</nav><div class="sidebar-bottom"><div class="user-mini"><span class="avatar">${esc(initials(state.user.name))}</span><span><b>${esc(state.user.name)}</b><small>${esc(roleNames[state.user.role] || state.user.role)}</small></span></div><button class="nav-link nav-action sidebar-logout" type="button" data-action="logout" title="Log out"><span class="nav-icon" aria-hidden="true">↪</span><span>Log out</span></button></div></aside><button class="sidebar-overlay" type="button" data-action="close-menu" aria-label="Close navigation"></button><main class="app-main"><header class="topbar"><div class="topbar-left"><button class="icon-btn switcher" data-action="toggle-menu" aria-label="Open navigation" aria-expanded="false">☰</button><a class="brand mobile-brand" href="#dashboard"><span class="brand-mark">C</span><span>CAMPUSLINK</span></a><span class="breadcrumb">${esc(roleNames[state.user.role])} workspace <span class="muted">/</span> ${esc(pageLabel(page))}</span></div><div class="topbar-center"><div class="searchbox"><span class="search-glyph" aria-hidden="true">⌕</span><input id="global-search" placeholder="Search jobs, internships, companies…" aria-label="Search jobs, internships and companies"></div></div><div class="topbar-right"><button class="icon-btn theme-toggle" type="button" data-action="toggle-theme" aria-label="Switch to ${theme === 'dark' ? 'light' : 'dark'} appearance" title="Switch appearance">${theme === 'dark' ? '☼' : '☾'}</button><button class="icon-btn notification-toggle" data-page="notifications" title="Notifications" aria-label="Notifications">♧<span class="notification-dot" id="notification-dot" hidden></span></button><a class="topbar-profile" href="#account" aria-label="Account overview for ${esc(state.user.name)}"><span class="avatar">${esc(initials(state.user.name))}</span><span class="topbar-profile-copy"><b>${esc(state.user.name)}</b><small>${esc(roleNames[state.user.role] || state.user.role)}</small></span><span class="profile-chevron" aria-hidden="true">⌄</span></a></div></header><section class="page" id="page-content"><div class="loading">Loading your workspace…</div></section></main><nav class="mobile-bottom-nav" aria-label="Primary navigation">${mobileNav}</nav></div>`;
    renderPage(page);
    api('/notifications').then(data => { const dot = $('#notification-dot'); if (dot && data.items.some(n => !n.read)) dot.hidden = false; }).catch(() => {});
  }

  function pageLabel(page) {
    const visit = nodes => {
      for (const node of nodes) {
        if (node.kind === 'group') { const child = visit(node.children); if (child) return child; }
        else if (node.kind === 'link' && routeMatches(node.href)) return node.label;
      }
      return null;
    };
    return visit(navForRole(state.user.role)) || (page.startsWith('jobs/') ? 'Vacancy details' : page.replaceAll('-', ' '));
  }

  async function renderPage(page) {
    state.page = page; const version = ++state.routeVersion;
    const container = $('#page-content'); if (!container) return;
    container.classList.toggle('dashboard-view', page === 'dashboard');
    container.innerHTML = '<div class="loading">Loading…</div>';
    try {
      let html;
      if (page === 'dashboard') html = await dashboardPage();
      else if (page === 'preparation') html = await preparationPage();
      else if (page === 'account') html = accountPage();
      else if (page === 'profile') html = await profilePage();
      else if (page === 'jobs') html = state.user.role === 'COMPANY' ? await companyJobsPage() : await jobsPage();
      else if (page.startsWith('jobs/')) html = await jobDetailPage(Number(page.split('/')[1]));
      else if (page === 'applications') html = await applicationsPage();
      else if (page === 'resume') html = await resumePage();
      else if (page === 'recommendations') html = await recommendationsPage();
      else if (page === 'quizzes') html = await quizzesPage();
      else if (page === 'interview') html = interviewPage();
      else if (page === 'communication') html = communicationPage();
      else if (page === 'roadmap') html = await roadmapPage();
      else if (page === 'tracker') html = await trackerPage();
      else if (page === 'resources') html = await resourcesPage();
      else if (page === 'readiness') html = readinessPage();
      else if (page === 'chatbot') html = chatbotPage();
      else if (page === 'notifications') html = await notificationsPage();
      else if (page === 'calendar') html = await calendarPage();
      else if (page === 'certificates') html = await certificatesPage();
      else if (page === 'projects') html = await projectsPage();
      else if (page === 'internships') html = await internshipsPage();
      else if (page === 'feedback') html = feedbackPage();
      else if (page === 'create-job' || page.startsWith('create-job/')) html = await createJobPage(page.startsWith('create-job/') ? Number(page.split('/')[1]) : null);
      else if (page === 'company-jobs' || page === 'jobs-list') html = await companyJobsPage();
      else if (page === 'candidates') html = await candidatesPage();
      else if (page === 'analytics' || page === 'skill-demand') html = await analyticsPage(page);
      else if (page === 'students') html = await adminStudentsPage();
      else if (page === 'companies') html = await adminCompaniesPage();
      else if (page === 'admin-jobs') html = await adminJobsPage();
      else if (page === 'admin-applications') html = await adminApplicationsPage();
      else if (page === 'placements') html = await placementsPage();
      else if (page === 'evidence') html = await evidencePage();
      else html = `<div class="card">${empty('Page not found', 'Use the navigation to open a CAMPUSLINK feature.')}</div>`;
      if (version !== state.routeVersion || !$('#page-content')) return;
      if (state.user.role==='ADMIN'&&(page==='dashboard'||page==='analytics')) html += `<div class="grid grid-2" style="margin-top:16px"><article class="card"><div class="card-head"><h3>Package analysis</h3></div><div class="chart-wrap"><canvas id="analytics-package-chart"></canvas></div></article><article class="card"><div class="card-head"><h3>Placement trend</h3></div><div class="chart-wrap"><canvas id="analytics-trend-chart"></canvas></div></article></div>`;
      container.innerHTML = page === 'home' ? html : `${pageBackControl()}${html}`;
      const routeParams = new URLSearchParams(state.routeQuery || '');
      if (page === 'candidates' && routeParams.has('job_id')) {
        const jobId=Number(routeParams.get('job_id'));
        if (jobId && $('#candidate-job')?.value===String(jobId)) await loadCandidates(jobId);
      }
      const sectionKey = routeParams.get('section');
      const sectionTarget = sectionKey && document.getElementById(`${page}-${sectionKey}`);
      if (sectionTarget) requestAnimationFrame(() => sectionTarget.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      if (page === 'projects' && routeParams.get('create') === '1') {
        const projectForm = $('#project-form');
        if (projectForm) { projectForm.hidden = false; requestAnimationFrame(() => projectForm.scrollIntoView({ behavior: 'smooth', block: 'center' })); }
      }
      if (page === 'projects' && routeParams.get('edit') === 'available') {
        const editInfo = $('#projects-edit-project');
        if (editInfo) requestAnimationFrame(() => editInfo.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      }
      if (page === 'certificates' && routeParams.get('create') === '1') {
        const certificateForm = $('#certificate-form');
        if (certificateForm) { certificateForm.hidden = false; requestAnimationFrame(() => certificateForm.scrollIntoView({ behavior: 'smooth', block: 'center' })); }
      }
      if (page === 'communication') {
        const transcript = $('#communication-transcript');
        if (transcript) transcript.scrollTop = transcript.scrollHeight;
      }
      if (page === 'dashboard') initDashboardCharts();
      if (page === 'analytics' || page === 'skill-demand') initAnalyticsCharts();
      if (page === 'quizzes' && state.quiz?.active) startQuizTimer();
      if (page === 'chatbot') renderChatMessages();
    } catch (error) {
      if (version === state.routeVersion) container.innerHTML = `${page === 'home' ? '' : pageBackControl()}<div class="card">${empty('Could not load this view', esc(error.message), '⚠')}</div>`;
    }
  }

  let dashboardChartData = null;
  function drawChart(id, type, labels, values, color = '#8b5cf6') {
    const canvas = document.getElementById(id); if (!canvas) return;
    const lightTheme = document.documentElement.dataset.theme === 'light';
    const axisText = lightTheme ? '#64748b' : '#a1a1aa';
    const gridLine = lightTheme ? 'rgba(50,70,100,.1)' : 'rgba(255,255,255,.07)';
    if (!window.Chart) {
      const parent = canvas.parentElement; const max = Math.max(1, ...values);
      parent.innerHTML = `<div class="bar-list">${labels.map((label, i) => `<div class="bar-row"><span>${esc(label)}</span><div class="bar-bg"><span style="width:${Math.round(values[i]/max*100)}%;background:${color}"></span></div><b>${esc(values[i])}</b></div>`).join('')}</div>`;
      return;
    }
    if (state.charts[id]) state.charts[id].destroy();
    const isPie = type === 'doughnut' || type === 'pie';
    state.charts[id] = new Chart(canvas, { type, data: { labels, datasets: [{ data: values, backgroundColor: isPie ? ['#8b5cf6','#6366f1','#a855f7','#7c3aed','#9b8afb','#5b6ee1','#c084fc','#818cf8'] : color, borderColor: color, borderWidth: 2, borderRadius: type === 'bar' ? 7 : 0, fill: type === 'line', tension: .35, pointRadius: type === 'line' ? 3 : 0 }] }, options: { maintainAspectRatio: false, responsive: true, plugins: { legend: { display: isPie, position: 'bottom', labels: { boxWidth: 9, usePointStyle: true, color: axisText, font: { family: 'DM Sans', size: 11 } } } }, scales: isPie ? {} : { x: { grid: { display: false }, ticks: { color: axisText, font: { family: 'DM Sans', size: 10 } }, border: { display: false } }, y: { beginAtZero: true, grid: { color: gridLine }, ticks: { precision: 0, color: axisText, font: { family: 'DM Sans', size: 10 } }, border: { display: false } } } } });
  }

  async function dashboardPage() {
    if (state.user.role === 'STUDENT') {
      const [d, openJobs, internshipRecords] = await Promise.all([api('/student/dashboard'), api('/jobs').then(result => result.items || []).catch(() => []), api('/student/internships').then(result => result.items || []).catch(() => [])]); dashboardChartData = d;
      const readiness = d.metrics.readiness;
      const studentSkills = Array.isArray(state.profile?.skills) ? state.profile.skills : [];
      const profileScore = profileCompletion({ ...(state.profile || {}), skills: studentSkills });
      const skillScore = studentSkills.length ? `${Math.round(studentSkills.reduce((total, skill) => total + (Number(skill.proficiency) || 0), 0) / studentSkills.length)}%` : 'Not added';
      const progressItems = (d.skill_progress || []).slice(0, 4);
      const featuredJobs = openJobs.slice(0, 3);
      return `${heading(`Good ${greeting()}, ${state.user.name.split(' ')[0]}`, 'Here’s your career progress today.', '<a class="btn btn-primary" href="#jobs">Explore vacancies <span aria-hidden="true">→</span></a>')}
        <div class="grid grid-4 dashboard-metrics">${metric('Profile completion',`${profileScore}%`,'◉')}${metric('Placement readiness',`${readiness}%`,'✦','teal')}${metric('Skill score',skillScore,'⌁')}${metric('Applications',d.metrics.applications,'↗')}</div>
        <div class="dashboard-layout"><div class="dashboard-main-column"><article class="card dashboard-opportunities"><div class="card-head"><div><span class="eyebrow">Your next opportunity</span><h3>Roles to explore</h3></div><a href="#jobs" class="btn-ghost">All opportunities <span aria-hidden="true">→</span></a></div>${featuredJobs.length ? `<div class="dashboard-job-list">${featuredJobs.map(job => `<a class="dashboard-job-card" href="#jobs/${job.id}"><span class="company-logo">${esc(initials(job.company).slice(0,1))}</span><span class="dashboard-job-copy"><b>${esc(job.title)}</b><small>${esc(job.company)} <i>·</i> ${esc(job.location || 'Location not listed')}</small></span><span class="dashboard-job-meta"><b>${job.salary ? money(job.salary) : 'View role'}</b><small>${esc(job.work_mode || job.type || 'Open role')}</small></span><span class="dashboard-job-arrow" aria-hidden="true">↗</span></a>`).join('')}</div>` : `<div class="dashboard-empty-jobs">${empty('No open roles yet','New opportunities will appear here when companies publish vacancies.','⌕')}</div>`}<a href="#jobs" class="dashboard-inline-link">Explore all opportunities <span aria-hidden="true">→</span></a></article>
          <article class="card dashboard-internships-card"><div class="card-head"><div><span class="eyebrow">Build your experience</span><h3>Internship records</h3></div><a href="#internships" class="btn-ghost">View all <span aria-hidden="true">→</span></a></div>${internshipRecords.length ? `<div class="dashboard-internship-list">${internshipRecords.slice(0,2).map(record=>`<div class="dashboard-internship-row"><span class="dashboard-internship-icon" aria-hidden="true">↗</span><span><b>${esc(record.role)}</b><small>${esc(record.company)} · ${esc(record.duration || 'Duration not listed')}</small></span>${badge(record.status)}</div>`).join('')}</div>` : `<div class="dashboard-empty-internship"><p>Add past or current experience and submit supporting evidence for review.</p><a href="#internships" class="btn btn-secondary btn-sm">Add an internship <span aria-hidden="true">→</span></a></div>`}</article>
          <div class="grid grid-2 dashboard-lower-grid"><article class="card dashboard-progress-card"><div class="card-head"><div><span class="eyebrow">Keep building</span><h3>Skill progress</h3></div><a class="btn-ghost" href="#profile?section=skills">Manage skills <span aria-hidden="true">→</span></a></div>${progressItems.length ? `<div class="dashboard-progress-list">${progressItems.map((skill,index)=>`<div class="dashboard-progress-row"><span class="dashboard-skill-icon tone-${index % 4}" aria-hidden="true">${['⌘','◇','✦','◉'][index % 4]}</span><span class="dashboard-progress-name">${esc(skill.name)}</span><span class="progress-bg"><span style="width:${Math.max(0,Math.min(100,Number(skill.value)||0))}%"></span></span><b>${Math.round(Number(skill.value)||0)}%</b></div>`).join('')}</div>`:`<div class="dashboard-nudge"><span class="metric-icon">⌁</span><p>Add skills to your profile to track your preparation progress.</p><a href="#profile?section=skills">Add skills <span aria-hidden="true">→</span></a></div>`}<div class="dashboard-tool-links"><a href="#quizzes"><span>✓</span> Practice a quiz</a><a href="#resources"><span>▷</span> Learning resources</a><a href="#roadmap"><span>⌖</span> Placement roadmap</a></div></article>
            <article class="card dashboard-application-card"><div class="card-head"><div><span class="eyebrow">Your activity</span><h3>Application status</h3></div><a href="#applications" class="btn-ghost">View all <span aria-hidden="true">→</span></a></div><div class="chart-wrap"><canvas id="student-status-chart"></canvas></div><div class="dashboard-application-summary"><span><b>${d.metrics.applications}</b><small>Applications</small></span><span><b>${d.metrics.placed}</b><small>Offers & placements</small></span><a href="#jobs">Find a role <span aria-hidden="true">↗</span></a></div></article></div></div>
          <aside class="dashboard-side-column"><article class="card dashboard-profile-card"><div class="dashboard-profile-top"><span class="dashboard-profile-avatar">${esc(initials(state.user.name))}</span><span class="dashboard-profile-copy"><b>${esc(state.user.name)}</b><small>${esc(state.profile?.branch || 'Student')} · Year ${esc(state.profile?.year || '—')}</small></span><a href="#profile" class="dashboard-profile-edit" aria-label="Edit profile">↗</a></div><div class="dashboard-profile-progress"><div><span>Profile strength</span><b>${profileScore}%</b></div><div class="progress-bg"><span style="width:${profileScore}%"></span></div></div><div class="dashboard-profile-stats"><span><b>${d.metrics.applications}</b><small>Applied</small></span><span><b>${d.metrics.interviews}</b><small>Interviews</small></span><span><b>${d.metrics.placed}</b><small>Placed</small></span></div><a href="#profile" class="btn btn-secondary dashboard-profile-button">View your profile <span aria-hidden="true">→</span></a></article>
            <article class="card dashboard-readiness-card"><div class="dashboard-readiness-summary"><div class="ring" style="--progress:${readiness}%"><strong>${readiness}%</strong></div><div><span class="eyebrow">Estimated readiness</span><h3>Build momentum</h3><small>Resume score: ${d.metrics.resume_score || 'Not analyzed'}${d.metrics.resume_score ? '/100' : ''}</small></div></div><p>${esc(d.metrics.readiness_note)}</p>${d.metrics.readiness_validation?`<small class="dashboard-readiness-validation">Validation · ${d.metrics.readiness_validation.test_records} students · balanced accuracy ${Math.round(d.metrics.readiness_validation.balanced_accuracy*100)}% · ROC-AUC ${Math.round(d.metrics.readiness_validation.roc_auc*100)}%</small>`:''}<p class="dashboard-readiness-caveat">This is preparation guidance, not a hiring probability.</p><a href="#readiness" class="dashboard-readiness-link">View readiness breakdown <span aria-hidden="true">→</span></a></article>
            <article class="card dashboard-assistant-card"><div class="dashboard-assistant-orb" aria-hidden="true"><span>✦</span></div><div class="dashboard-assistant-content"><span class="eyebrow">CAMPUSLINK AI</span><h3>Your career co-pilot</h3><p>Get focused help with interviews, study plans and your next application.</p><button class="btn btn-primary" type="button" data-assistant-toggle aria-expanded="${state.assistantOpen}">Ask Jarvis <span aria-hidden="true">↗</span></button><div class="dashboard-assistant-prompts"><button type="button" data-assistant-action="quick" data-mode="placement" data-prompt="Help me make a focused plan for my next placement opportunity.">Build a plan</button><button type="button" data-assistant-action="quick" data-mode="mock_interview" data-prompt="Give me one interview question based on my career goal and help me practice.">Practice interview</button></div></div></article>
            <article class="card dashboard-tasks-card"><div class="card-head"><div><span class="eyebrow">On your calendar</span><h3>Coming up</h3></div><a href="#calendar" class="btn-ghost">View calendar <span aria-hidden="true">→</span></a></div>${d.upcoming_events.length ? `<div class="dashboard-event-list">${d.upcoming_events.slice(0,3).map((event,index)=>`<div class="dashboard-event"><span class="dashboard-event-icon tone-${index % 3}" aria-hidden="true">${['□','✓','◷'][index % 3]}</span><span><b>${esc(event.title)}</b><small>${esc(event.type)} · ${new Date(event.starts_at).toLocaleString()}</small></span></div>`).join('')}</div>` : `<div class="dashboard-empty-event"><span class="dashboard-event-icon tone-0" aria-hidden="true">□</span><p>Nothing scheduled yet.</p><a href="#calendar">Add a reminder <span aria-hidden="true">→</span></a></div>`}</article></aside></div>`;
    }
    if (state.user.role === 'COMPANY') {
      const d = await api('/company/dashboard'); dashboardChartData = d;
      return `${heading(`Welcome, ${state.profile?.company_name || state.user.name}`, 'Recruiter workspace · manage vacancies and candidates.', '<a class="btn btn-primary" href="#create-job">+ Post a vacancy</a>')}<div class="grid grid-4">${metric('Active vacancies',d.metrics.jobs,'▤')}${metric('Applications',d.metrics.applications,'↗')}${metric('Shortlisted',d.metrics.shortlisted,'✓','green')}${metric('Interviews',d.metrics.interviews,'◌','teal')}</div><div class="grid grid-main" style="margin-top:16px"><article class="card"><div class="card-head"><h3>My vacancies</h3><a class="btn-ghost" href="#jobs">Manage all →</a></div>${d.jobs.length ? `<div class="table-wrap"><table><thead><tr><th>Role</th><th>Location</th><th>Applicants</th><th>Status</th></tr></thead><tbody>${d.jobs.slice(0,6).map(j=>`<tr><td><b>${esc(j.title)}</b><div class="muted">${esc(j.required_skills.slice(0,3).join(' · '))}</div></td><td>${esc(j.location)}</td><td>${d.metrics.applications}</td><td>${badge(j.deadline && new Date(j.deadline)<new Date()?'Closed':'Open')}</td></tr>`).join('')}</tbody></table></div>` : empty('No vacancies yet','Post a role to start receiving matched applications.')}</article><article class="card"><div class="card-head"><h3>Hiring funnel</h3></div><div class="chart-wrap"><canvas id="company-funnel-chart"></canvas></div></article></div>`;
    }
    const d = await api('/admin/dashboard'); dashboardChartData = d;
    return `${heading('Placement overview','A current view of student outcomes and recruiter activity.')}<div class="grid grid-4">${metric('Students',d.metrics.students,'♙')}${metric('Companies',d.metrics.companies,'◉')}${metric('Open vacancies',d.metrics.jobs,'▤')}${metric('Placement rate',`${d.metrics.placement_rate}%`,'↗','green')}${metric('Applications',d.metrics.applications,'↗')}${metric('Shortlisted',d.metrics.shortlisted,'✓','teal')}${metric('Placed',d.metrics.placed,'✦','green')}${metric('Average package',d.metrics.average_package?`${d.metrics.average_package} LPA`:'—','₹','amber')}</div><div class="grid grid-main" style="margin-top:16px"><article class="card"><div class="card-head"><h3>Branch placement rate</h3><a class="btn-ghost" href="#analytics">View analytics →</a></div><div class="chart-wrap"><canvas id="admin-branch-chart"></canvas></div></article><article class="card"><div class="card-head"><h3>Application funnel</h3></div><div class="chart-wrap"><canvas id="admin-funnel-chart"></canvas></div></article></div><div class="grid grid-2" style="margin-top:16px"><article class="card"><div class="card-head"><h3>In-demand skills</h3><a href="#skill-demand" class="btn-ghost">See detail →</a></div><div class="bar-list">${d.skill_demand.slice(0,7).map(x=>`<div class="bar-row"><span>${esc(x.skill)}</span><div class="bar-bg"><span style="width:${Math.round(x.jobs/Math.max(1,d.skill_demand[0]?.jobs||1)*100)}%"></span></div><b>${x.jobs}</b></div>`).join('')}</div></article><article class="card"><div class="card-head"><h3>Companies hiring</h3></div>${d.companies_hiring.slice(0,5).map(x=>`<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--line);font-size:.83rem"><span>${esc(x.company)}</span><b>${x.jobs} roles</b></div>`).join('')}</article></div>`;
  }
  function greeting() { const h = new Date().getHours(); return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'; }
  function initDashboardCharts() {
    const d = dashboardChartData; if (!d) return;
    if (state.user.role === 'STUDENT') {
      const statuses = d.application_status; drawChart('student-status-chart','doughnut',Object.keys(statuses).filter(k=>statuses[k]),Object.keys(statuses).filter(k=>statuses[k]).map(k=>statuses[k]));
      const skills = d.skill_progress || []; drawChart('student-skill-chart','bar',skills.map(x=>x.name),skills.map(x=>x.value),'#8b5cf6');
    } else if (state.user.role === 'COMPANY') drawChart('company-funnel-chart','bar',Object.keys(d.funnel),Object.values(d.funnel),'#8b5cf6');
    else { drawChart('admin-branch-chart','bar',d.branches.map(x=>x.branch),d.branches.map(x=>x.rate),'#8b5cf6'); drawChart('admin-funnel-chart','doughnut',Object.keys(d.funnel),Object.values(d.funnel)); drawChart('analytics-package-chart','doughnut',Object.keys(d.package_analysis||{}),Object.values(d.package_analysis||{})); drawChart('analytics-trend-chart','line',(d.placement_trend||[]).map(x=>x.month),(d.placement_trend||[]).map(x=>x.count),'#8b5cf6'); }
  }

  async function preparationPage() {
    const progress = await api('/student/preparation');
    return `${heading('Preparation dashboard','Your practice activity, skill progress and next placement steps.')}<div class="grid grid-4">${metric('Skills listed',progress.skills?.length||0,'⌁')}${metric('Quizzes completed',progress.quizzes,'✓','teal')}${metric('Mock interviews',progress.interviews,'◌')}${metric('Applications',progress.applications,'↗','green')}</div><div class="grid grid-2" style="margin-top:16px"><article class="card"><div class="card-head"><h3>Pick up your preparation</h3></div><div class="account-link-list"><a href="#resources"><span class="nav-icon">▷</span><span><b>Learning resources</b><small>Browse course and video resources</small></span><i>→</i></a><a href="#quizzes"><span class="nav-icon">✓</span><span><b>Quick skill quiz</b><small>Practice from your branch-aware question bank</small></span><i>→</i></a><a href="#interview"><span class="nav-icon">◌</span><span><b>Mock interview</b><small>Practice answers and review feedback</small></span><i>→</i></a><a href="#communication"><span class="nav-icon">◉</span><span><b>Communication practice</b><small>Build confidence with guided sessions</small></span><i>→</i></a></div></article><article class="card"><div class="card-head"><h3>Plan your next step</h3></div><div class="account-link-list"><a href="#roadmap"><span class="nav-icon">⌖</span><span><b>Placement roadmap</b><small>Follow and update your preparation plan</small></span><i>→</i></a><a href="#recommendations"><span class="nav-icon">⌁</span><span><b>Skill recommendations</b><small>See skills related to active roles</small></span><i>→</i></a><a href="#tracker"><span class="nav-icon">▥</span><span><b>Preparation tracker</b><small>Review projects, quizzes and skill progress</small></span><i>→</i></a><a href="#readiness"><span class="nav-icon">✦</span><span><b>Professional readiness</b><small>Review interview and workplace guidance</small></span><i>→</i></a></div></article></div>`;
  }

  function accountNameSettings() {
    return `<form class="card account-change-form" data-form="account-name"><div class="profile-section-heading"><span class="nav-icon">◉</span><div><h3>Change account name</h3><p class="muted">Confirm your current password before saving a new name.</p></div></div><div class="field"><label for="account-new-name">Account name</label><input id="account-new-name" name="name" value="${esc(state.user.name)}" maxlength="120" autocomplete="name" required></div><div class="field"><label for="account-name-current-password">Current password</label><input id="account-name-current-password" name="current_password" type="password" autocomplete="current-password" required></div><button class="btn btn-primary" type="submit">Save account name</button></form>`;
  }

  function accountPasswordSettings() {
    return `<form class="card account-change-form" data-form="account-password"><div class="profile-section-heading"><span class="nav-icon">▣</span><div><h3>Change password</h3><p class="muted">Enter your current password, then choose a new password with at least 8 characters.</p></div></div><div class="field"><label for="account-password-current">Current password</label><input id="account-password-current" name="current_password" type="password" autocomplete="current-password" required></div><div class="field"><label for="account-password-new">New password</label><input id="account-password-new" name="new_password" type="password" autocomplete="new-password" minlength="8" required></div><div class="field"><label for="account-password-confirm">Confirm new password</label><input id="account-password-confirm" name="confirm_password" type="password" autocomplete="new-password" minlength="8" required></div><button class="btn btn-primary" type="submit">Save new password</button></form>`;
  }

  function accountPage() {
    const section = new URLSearchParams(state.routeQuery || '').get('section') || 'overview';
    const theme = localStorage.getItem('campuslink_theme') || 'dark';
    const sectionContent = {
      general: ['General Settings', 'Update your account name. Your current password is required to confirm this change.', accountNameSettings()],
      security: ['Password & Security', 'Change your password using your current password. Passwords are stored as secure hashes.', accountPasswordSettings()],
      sessions: ['Login & Sessions', 'CAMPUSLINK currently uses signed bearer sessions. Session history and remote session revocation are not available in this version.'],
      'email-notifications': ['Email Notifications', 'CAMPUSLINK currently shows in-app vacancy and application alerts. Email delivery preferences are not configured. <a href="#notifications">View in-app notifications →</a>'],
      privacy: ['Privacy Settings', 'Review and update the profile information you share with CAMPUSLINK. Your date of birth is never included in profile or authentication API responses. <a href="#profile?section=personal-information">Review profile information →</a>'],
      data: ['Data & Permissions', 'Your student profile data is used for job matching, preparation recommendations and placement analytics. Contact the placement team through feedback for data access questions. <a href="#feedback">Contact the placement team →</a>'],
      appearance: ['Appearance', `Choose the workspace appearance. Current theme: <b>${theme === 'light' ? 'Light' : 'Dark'}</b>. <button class="btn btn-secondary" type="button" data-action="toggle-theme">Switch to ${theme === 'light' ? 'dark' : 'light'} mode</button>`],
      help: ['Help & Support', 'For help with CAMPUSLINK, send a message to the placement team. <a class="btn btn-secondary" href="#feedback">Contact support or report a problem →</a>'],
      about: ['About CAMPUSLINK', 'CAMPUSLINK connects student preparation, recruiter workflows and placement analytics in one career workspace.'],
    };
    if (section !== 'overview') {
      const [title, copy, action = ''] = sectionContent[section] || ['Account Settings', 'This account section is not configured yet. Use the linked profile, notification and feedback pages to manage the available account features.'];
      return `${heading(title, 'Account settings')}<article class="card account-settings-panel"><div class="account-section-icon">${section === 'appearance' ? '◐' : section === 'security' ? '▣' : '◉'}</div><p class="muted">${copy}</p>${action}</article><p class="muted account-note">Account changes require your current password.</p>`;
    }
    return `${heading('Account overview','Manage your account name, password and signed-in access.')}<article class="card account-summary-card"><span class="eyebrow">Signed in as</span><h2>${esc(state.user.name)}</h2><p>${esc(roleNames[state.user.role] || state.user.role)}</p><small>${esc(state.user.email)}</small></article><div class="account-change-grid">${accountNameSettings()}${accountPasswordSettings()}</div><article class="card account-session-actions"><div><span class="eyebrow">Account access</span><h3>Use another account</h3><p class="muted">Sign out to log in to or register another CAMPUSLINK account on this device.</p></div><div class="account-session-buttons"><button class="btn btn-secondary" type="button" data-action="add-account">Add another account</button><button class="btn btn-ghost" type="button" data-action="logout">Log out</button></div></article><div class="grid grid-2" style="margin-top:16px"><article class="card"><div class="card-head"><h3>Profile settings</h3></div><p class="muted">Update personal, academic and recovery information.</p><a class="btn btn-secondary btn-sm" href="#profile">Open profile →</a></article><article class="card"><div class="card-head"><h3>Notifications & support</h3></div><p class="muted">Review vacancy and application alerts or contact the CAMPUSLINK team.</p><div class="account-session-buttons"><a class="btn btn-secondary btn-sm" href="#notifications">View notifications</a><a class="btn btn-ghost btn-sm" href="#feedback">Help & support</a></div></article></div>`;
  }

  function profileCollectionRow(key, value = '') {
    const labels = { courses: 'Course', achievements: 'Achievement', interest_tags: 'Interest' };
    const label = labels[key] || 'Profile item';
    const maxLength = key === 'achievements' ? 500 : key === 'interest_tags' ? 120 : 160;
    const rowClass = key === 'interest_tags' ? 'profile-collection-row profile-tag-row' : 'profile-collection-row';
    return `<div class="${rowClass}"><input type="text" data-profile-collection="${esc(key)}" value="${esc(value)}" maxlength="${maxLength}" aria-label="${label}" placeholder="${key === 'courses' ? 'e.g. Bachelor of Computer Applications' : key === 'achievements' ? 'e.g. First place in a coding competition' : 'e.g. Data analysis'}"><button class="btn btn-ghost profile-remove-item" type="button" data-action="profile-remove-item" data-collection="${esc(key)}" aria-label="Remove ${label}">Remove</button></div>`;
  }

  function profileCollectionEditor(key, label, values, help) {
    const rows = Array.isArray(values) && values.length ? values : [''];
    const addLabels = { courses: 'Course', achievements: 'Achievement', interest_tags: 'Interest' };
    return `<div class="profile-collection" data-collection-group="${esc(key)}"><div class="profile-collection-heading"><label>${label}</label><button class="btn btn-secondary btn-sm" type="button" data-action="profile-add-item" data-collection="${esc(key)}">Add ${addLabels[key] || 'item'}</button></div><div class="profile-collection-list" data-collection-list="${esc(key)}">${rows.map(value => profileCollectionRow(key, value)).join('')}</div><small>${help}</small></div>`;
  }

  async function profilePage() {
    const section = new URLSearchParams(state.routeQuery || '').get('section') || 'overview';
    if (state.user.role === 'ADMIN') return `${heading('Account recovery','Manage the verification details used to recover your account.')}<div class="card profile-placeholder" id="profile-overview"><h3>Placement officer account</h3><p class="muted">Your account recovery details are managed below. Other student profile fields do not apply to this role.</p></div>${recoveryDetailsForm()}`;
    if (state.user.role === 'COMPANY') {
      const { profile } = await api('/company/profile'); state.profile = profile;
      return `${heading('Company profile','Manage the details candidates see when they explore your vacancies.')}<div id="profile-overview"><form class="card" data-form="company-profile" id="profile-edit-profile"><section class="profile-settings-section" id="profile-personal-information"><h3>Company information</h3><div class="form-grid"><div class="field"><label>Company Name</label><input name="company_name" value="${esc(profile.company_name)}" placeholder="Enter your company name" required></div><div class="field"><label>Industry</label><input name="industry" value="${esc(profile.industry)}"></div><div class="field"><label>Location</label><input name="location" value="${esc(profile.location)}"></div><div class="field"><label>Website</label><input name="website" type="url" value="${esc(profile.website)}" placeholder="https://"></div><div class="field full"><label>Company description</label><textarea name="description">${esc(profile.description)}</textarea></div></div></section><button class="btn btn-primary" type="submit">Save profile</button></form></div>`;
    }
    const [{ profile }, { items: branches }] = await Promise.all([api('/student/profile'), api('/branches')]);
    state.profile = profile;
    const selectedBranchId = String(profile.branch_id || '');
    const branchIsKnown = branches.some(branch => String(branch.id) === selectedBranchId);
    const branchOptions = `<option value="" disabled ${branchIsKnown?'':'selected'}>Choose a branch</option>${branches.map(branch => `<option value="${Number(branch.id)}" ${String(branch.id) === selectedBranchId ? 'selected' : ''}>${esc(branch.name)}</option>`).join('')}`;
    const completion = profileCompletion(profile);
    return `${heading('My profile','Manage your personal details, academics and placement profile.')}<article class="card profile-overview" id="profile-overview"><div><span class="eyebrow">Profile overview</span><h2>${esc(profile.name)}</h2><p class="muted">${esc(profile.branch || 'Branch not selected')} · Year ${esc(profile.year)} · Semester ${esc(profile.semester)}</p></div><div class="profile-completion-ring" style="--completion:${completion}%"><b>${completion}%</b><small>complete</small></div></article><form class="card profile-editor" data-form="student-profile" id="profile-edit-profile"><section class="profile-settings-section" id="profile-personal-information"><div class="profile-section-heading"><span class="nav-icon">◎</span><div><h3>Personal Information</h3><p class="muted">Your account identity and contact details.</p></div></div><div class="form-grid"><div class="field"><label>Full name</label><input name="name" value="${esc(profile.name)}" required></div><div class="field"><label>Email</label><input value="${esc(profile.email)}" disabled></div><div class="field"><label>Phone number</label><input name="phone" type="tel" inputmode="numeric" autocomplete="tel" maxlength="10" minlength="10" pattern="[0-9]{10}" title="Enter exactly 10 digits" value="${esc(profile.phone)}" required></div><div class="field"><label>Gender</label><select name="gender"><option value="" ${!profile.gender?'selected':''}>Select gender</option>${['Male','Female','Other','Prefer not to say'].map(option=>`<option value="${esc(option)}" ${profile.gender===option?'selected':''}>${esc(option)}</option>`).join('')}</select></div></div></section><section class="profile-settings-section" id="profile-academic-information"><div class="profile-section-heading"><span class="nav-icon">▤</span><div><h3>Academic Information</h3><p class="muted">Your college and current academic progress.</p></div></div><div class="form-grid"><div class="field"><label>College / University</label><input name="college_name" maxlength="180" value="${esc(profile.college_name||'')}" placeholder="Enter your college name"></div><div class="field"><label>Branch / Department</label><select name="branch" required>${branchOptions}</select><small>Choose a branch from CAMPUSLINK’s current branch list.</small></div>${profileCollectionEditor('courses','Courses',profile.courses,'Add the courses you are currently studying.')}<div class="field"><label>Year</label><select name="year">${[1,2,3,4].map(x=>`<option value="${x}" ${Number(profile.year)===x?'selected':''}>Year ${x}</option>`).join('')}</select></div><div class="field"><label>Semester</label><select name="semester">${Array.from({length:8},(_,i)=>i+1).map(x=>`<option value="${x}" ${Number(profile.semester)===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>CGPA (0–10)</label><input type="number" name="cgpa" min="0" max="10" step=".01" value="${esc(profile.cgpa)}"></div><div class="field"><label>Attendance (%)</label><input type="number" name="attendance" min="0" max="100" step=".1" value="${esc(profile.attendance)}"></div><div class="field"><label>Graduation year</label><input type="number" name="graduation_year" min="1900" max="2100" step="1" value="${esc(profile.graduation_year ?? '')}" placeholder="e.g. 2027"><small>Enter the year you expect to graduate.</small></div></div></section><section class="profile-settings-section" id="profile-skills"><div class="profile-section-heading"><span class="nav-icon">⌁</span><div><h3>Skills</h3><p class="muted">CAMPUSLINK stores your skills as a single list for matching and recommendations.</p></div></div><div class="field"><label>Programming languages, technical skills, soft skills, tools & technologies</label><input name="skills" value="${esc(profile.skills.map(x=>x.name).join(', '))}" placeholder="Python, SQL, Git"><small>Separate skills with commas.</small></div><div class="chip-list">${profile.skills.length ? profile.skills.map(s=>`<span class="chip">${esc(s.name)} · ${s.proficiency}%</span>`).join('') : '<span class="muted">Add skills above to get started.</span>'}</div></section><section class="profile-settings-section" id="profile-achievements"><div class="profile-section-heading"><span class="nav-icon">☆</span><div><h3>Achievements</h3><p class="muted">Add certifications, awards, accomplishments, and other milestones.</p></div></div>${profileCollectionEditor('achievements','Achievements',profile.achievements,'You can add multiple achievements and remove them at any time.')}</section><section class="profile-settings-section" id="profile-career-information"><h3>Career information</h3><div class="form-grid"><div class="field"><label>Career goal</label><input name="career_goal" value="${esc(profile.career_goal)}" placeholder="e.g. Data Analyst"></div>${profileCollectionEditor('interest_tags','Interests',profile.interest_tags,'Add interests to personalize skill recommendations.')}<div class="field"><label>About me</label><textarea name="bio">${esc(profile.bio)}</textarea></div></div></section><button class="btn btn-primary" type="submit">Save Changes</button></form>${recoveryDetailsForm()}<div class="grid grid-2" style="margin-top:16px"><article class="card" id="profile-profile-completion"><div class="card-head"><h3>Profile completion</h3><span class="score">${completion}%</span></div><div class="progress-bg"><span style="width:${completion}%"></span></div><p class="muted" style="font-size:.8rem;margin-top:10px">Add projects, internship evidence and a resume to strengthen your profile.</p></article><article class="card"><div class="card-head"><h3>Profile links</h3><a class="btn-ghost" href="#recommendations">See skill gaps →</a></div><div class="account-link-list"><a href="#resume"><span class="nav-icon">▧</span><span><b>Resume</b><small>Upload and review resume analysis</small></span><i>→</i></a><a href="#projects"><span class="nav-icon">⌘</span><span><b>Projects</b><small>View and add project records</small></span><i>→</i></a><a href="#certificates"><span class="nav-icon">◇</span><span><b>Certifications</b><small>View and add certificate records</small></span><i>→</i></a></div></article></div>`;
  }
  function profileCompletion(p) { const checks = [p.name,p.phone,p.gender,p.branch,p.courses?.length,p.cgpa,p.attendance,p.graduation_year,p.career_goal,p.interest_tags?.length,p.achievements?.length,p.skills.length,p.bio,p.resume_filename]; return Math.round(checks.filter(Boolean).length/checks.length*100); }

  async function jobsPage() {
    const params = new URLSearchParams(state.routeQuery || '');
    const query = $('#job-filter')?.value || params.get('q') || '';
    const branch=params.get('branch')||'';const filters=new URLSearchParams();if(query)filters.set('q',query);if(branch)filters.set('branch',branch);
    const data = await api(`/jobs${filters.toString()?`?${filters.toString()}`:''}`);
    return `${heading('Explore vacancies','See current roles and how your profile aligns with their requirements.')}<div class="filter-row"><input id="job-filter" value="${esc(query)}" placeholder="Search role or keyword"><select id="branch-filter"><option value="">All branches</option>${['CSE','CSE-AI','ECE','EEE','Mechanical','Civil'].map(b=>`<option ${b===branch?'selected':''}>${b}</option>`).join('')}</select><button class="btn btn-secondary btn-sm" data-action="filter-jobs">Search vacancies</button></div><div class="grid grid-2">${data.items.length ? data.items.map(jobCard).join('') : `<div class="card">${empty('No matching roles','Try a different title or check back when companies publish vacancies.')}</div>`}</div>`;
  }
  function jobCard(j) {
    const m=j.match;
    return `<article class="job-card"><div class="job-title-row"><div style="display:flex;gap:12px"><span class="company-logo">${esc(initials(j.company).slice(0,1))}</span><div><h3 style="margin:2px 0 4px"><a href="#jobs/${j.id}">${esc(j.title)}</a></h3><div class="muted" style="font-size:.8rem">${esc(j.company)} · ${esc(j.industry || 'Company')}</div></div></div>${m?`<div class="score-circle" style="--score:${m.score}"><span>${m.score}%</span></div>`:''}</div><div class="job-meta"><span>⌖ ${esc(j.location || 'Location not listed')}</span><span>₹ ${money(j.salary)}</span><span>◷ Deadline ${dateText(j.deadline)}</span></div><p>${esc((j.description||'').slice(0,155))}${j.description?.length>155?'…':''}</p><div class="chip-list" style="margin:12px 0 15px">${j.required_skills.slice(0,5).map(s=>`<span class="chip">${esc(s)}</span>`).join('')}</div><div class="job-actions"><span class="muted" style="font-size:.75rem">${j.vacancies} opening${j.vacancies===1?'':'s'} · CGPA ${j.minimum_cgpa}+</span><a class="btn btn-secondary btn-sm" href="#jobs/${j.id}">View role →</a></div></article>`;
  }

  async function jobDetailPage(id) {
    const { job:j } = await api(`/jobs/${id}`); const m=j.match;
    return `${heading('Vacancy details','Review role expectations and your estimated fit before applying.', '<a class="btn btn-secondary" href="#jobs">← All vacancies</a>')}<div class="grid grid-main"><div class="grid"><article class="card"><div style="display:flex;gap:15px;align-items:flex-start"><span class="company-logo">${esc(initials(j.company).slice(0,1))}</span><div><span class="eyebrow">${esc(j.industry||'Opportunity')}</span><h2 style="margin:5px 0">${esc(j.title)}</h2><p class="muted">${esc(j.company)} · ${esc(j.location)} · ${money(j.salary)}</p></div></div><hr style="border:0;border-top:1px solid var(--line);margin:20px 0"><h3>Job description</h3><p>${esc(j.description)}</p><h3 style="margin-top:22px">Requirements</h3><div class="chip-list" style="margin:10px 0 18px">${j.required_skills.map(s=>`<span class="chip">${esc(s)}</span>`).join('')||'<span class="muted">No required skills listed.</span>'}</div><div class="grid grid-2"><div><div class="muted" style="font-size:.75rem">ELIGIBLE BRANCHES</div><b>${esc(j.eligible_branches.join(', ')||'All branches')}</b></div><div><div class="muted" style="font-size:.75rem">MINIMUM CGPA</div><b>${j.minimum_cgpa}</b></div><div><div class="muted" style="font-size:.75rem">MINIMUM ATTENDANCE</div><b>${j.minimum_attendance}%</b></div><div><div class="muted" style="font-size:.75rem">EXPERIENCE</div><b>${esc(j.experience)}</b></div><div><div class="muted" style="font-size:.75rem">VACANCIES</div><b>${j.vacancies}</b></div><div><div class="muted" style="font-size:.75rem">APPLICATION DEADLINE</div><b>${dateText(j.deadline)}</b></div></div><h3 style="margin-top:22px">Terms & conditions</h3><p>${esc(j.terms||'Please review the recruiter’s process when shortlisted.')}</p></article><article class="card"><div class="card-head"><h3>About ${esc(j.company)}</h3></div><p>${esc(j.company)} is hiring for this role. Reach out through the application process for role questions.</p><div class="muted" style="font-size:.82rem">Recruiter: ${esc(j.recruiter||'Recruiting team')}<br>Industry: ${esc(j.industry||'—')}<br>Location: ${esc(j.company_location||j.location||'—')}</div></article></div><aside class="grid"><article class="card"><div class="card-head"><div><span class="eyebrow">Explainable AI</span><h3 style="margin-top:5px">Your job match</h3></div>${m?`<div class="score-circle" style="--score:${m.score}"><span>${m.score}%</span></div>`:''}</div><p class="muted" style="font-size:.75rem">Estimated Job Match · This is a profile fit estimate, not a hiring probability.</p>${m?`<div class="match-explain"><h4>Why this score</h4><ul>${m.reasons.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div><div class="muted" style="font-size:.8rem;margin-top:12px">Skill match: <b>${m.skill_match_percentage}%</b> · ${m.matched_skills.length} of ${m.total_required_skills} required</div><h4 style="margin:17px 0 8px">Matched skills</h4><div class="chip-list">${m.matched_skills.map(x=>`<span class="chip">✓ ${esc(x)}</span>`).join('')||'<span class="muted">No required skills matched yet.</span>'}</div><h4 style="margin:17px 0 8px">Skills to build</h4><div class="chip-list">${m.missing_skills.map(x=>`<span class="chip missing">+ ${esc(x)}</span>`).join('')||'<span class="muted">All listed skills match.</span>'}</div><h4 style="margin:17px 0 8px">Ways to improve</h4><ul style="padding-left:18px;font-size:.81rem;color:#586e82">${m.recommendations.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><h4 style="margin:17px 0 8px">Learning resources for skill gaps</h4>${m.skill_recommendations?.length ? `<ul style="padding-left:18px;font-size:.81rem;color:#586e82">${m.skill_recommendations.flatMap(group=>group.courses.map(resource=>`<li><b>${esc(group.skill)}</b>: ${resource.url?.startsWith('https://')?`<a href="${esc(resource.url)}" target="_blank" rel="noopener noreferrer">${esc(resource.title)}</a>`:esc(resource.title)}</li>`)).join('')}</ul>` : '<p class="muted" style="font-size:.8rem">No mapped learning resources are available for the missing skills yet.</p>'}`:''}<small class="muted" style="display:block;margin-top:12px">Applying shares your profile and contact details with ${esc(j.company)}.</small><button class="btn btn-primary" style="width:100%;margin-top:15px" data-action="apply-job" data-id="${j.id}" ${!m?.eligible?'title="Eligibility criteria are not currently met"':''}>Apply to this role</button>${!m?.eligible?'<small class="muted" style="display:block;margin-top:7px">Some eligibility requirements are not met. You can still review your preparation with the placement office.</small>':''}</article></aside></div>`;
  }

  async function applicationsPage() {
    const {items} = await api('/student/applications');
    return `${heading('My applications','Follow every application status from submission through joining.')}<div class="grid">${items.length ? items.map(a=>`<article class="card"><div class="card-head"><div><h3>${esc(a.job?.title||'Role')}</h3><p class="muted" style="font-size:.8rem;margin:4px 0">${esc(a.job?.company||'Company')} · Applied ${dateText(a.created_at)}</p></div><div style="display:flex;align-items:center;gap:12px"><div class="score-circle" style="--score:${a.match_score}"><span>${Math.round(a.match_score)}%</span></div>${badge(a.status)}</div></div><div class="timeline">${['Applied','Shortlisted','Assessment','Interview','Selected','Offer','Joined'].map((s,i)=>{const stages=['Applied','Shortlisted','Assessment','Interview','Selected','Offer','Joined'];const cur=stages.indexOf(a.status);return `<div class="timeline-step ${i<=cur?'done':''}"><i></i>${s}</div>`}).join('')}</div><p class="muted" style="font-size:.76rem;margin:6px 0 0">Current status: ${esc(a.status)}. Status changes are supplied by the company or placement office.</p></article>`).join('') : `<div class="card">${empty('No applications yet','Explore current vacancies to see your estimated match and apply.') }<a class="btn btn-primary" href="#jobs">Explore vacancies</a></div>`}</div>`;
  }

  async function resumePage() {
    const [saved, jobData] = await Promise.all([
      api('/resume/analysis'),
      api('/jobs').catch(() => ({ items: [] })),
    ]);
    const analysis = saved.analysis;
    const jobs = jobData.items || [];
    const selectedJob = analysis?.target_job_id ? String(analysis.target_job_id) : '';
    const list = values => Array.isArray(values) ? values : [];
    const chips = (values, kind = '') => [...new Map(list(values).map(value => [String(value).toLocaleLowerCase(), value])).values()].length
      ? `<div class="chip-list">${[...new Map(list(values).map(value => [String(value).toLocaleLowerCase(), value])).values()].map(value => `<span class="chip ${kind}">${esc(value)}</span>`).join('')}</div>`
      : '<p class="muted">None identified.</p>';
    const evidence = (title, values) => `<section class="resume-report-section"><h4>${title}</h4>${list(values).length ? `<ul>${list(values).map(value => `<li>${esc(value)}</li>`).join('')}</ul>` : '<p class="muted">No entries were found in a labeled section.</p>'}</section>`;
    const report = analysis ? (() => {
      const match = analysis.match_percentage != null && Number.isFinite(Number(analysis.match_percentage)) ? Number(analysis.match_percentage) : null;
      const ai = analysis.ai_review || {};
      const roadmap = list(analysis.learning_roadmap);
      const partial = list(analysis.partially_matched_skills);
      const totalRequired = Number(analysis.total_required_skills ?? list(analysis.target_skills).length);
      const matchedCount = list(analysis.matched_skills).length;
      const courseLink = resource => /^https?:\/\//i.test(resource.url || '')
        ? `<a class="btn-ghost" href="${esc(resource.url)}" target="_blank" rel="noopener noreferrer">${esc(resource.title)} ↗</a>`
        : `<span>${esc(resource.title)}</span>`;
      return `<article class="card" id="resume-view">
        <div class="card-head"><div><span class="eyebrow">Latest analysis · ${esc(analysis.filename)}</span><h2 style="margin:5px 0">${esc(analysis.target_role || 'Resume review')}</h2><p class="muted">${esc(totalRequired ? `${totalRequired} role requirements compared` : 'No role requirements were available for comparison')}</p></div><div class="score-circle" style="--score:${match ?? analysis.score ?? 0}"><span>${match === null ? `${analysis.score ?? 0}` : `${match}%`}</span></div></div>
        ${match !== null ? `<div class="resume-match-summary"><div class="card-head"><b>Overall skill match</b><strong>${match}%</strong></div><div class="progress-bg" role="progressbar" aria-label="Overall skill match" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${match}"><span style="width:${Math.max(0, Math.min(100, match))}%"></span></div><small class="muted">${matchedCount} of ${totalRequired} required skills matched exactly. Partial evidence is shown separately and does not increase this percentage.</small></div>` : '<p class="match-explain">Select a vacancy or provide a job description to calculate a role-specific match percentage.</p>'}
        <div class="grid grid-2" style="margin-top:18px"><section><h4>Matched skills</h4>${chips(analysis.matched_skills || analysis.detected_skills)}</section><section><h4>Partially matched skills</h4>${partial.length ? `<div class="chip-list">${partial.map(item => `<span class="chip warning">${esc(item.skill)} · evidence: ${esc(list(item.evidence).join(', '))}</span>`).join('')}</div>` : '<p class="muted">None identified.</p>'}</section><section><h4>Missing role skills</h4>${chips(analysis.missing_skills, 'missing')}</section><section><h4>Additional relevant skills</h4>${chips(analysis.additional_relevant_skills)}</section></div>
        <div class="resume-report-section"><h3>Resume strengths</h3>${chips([...(list(analysis.strengths)), ...list(ai.strengths)])}</div>
        <div class="resume-report-section"><h3>Areas to improve</h3>${chips([...(list(analysis.weaknesses)), ...list(ai.risks)], 'missing')}</div>
        ${ai.status === 'ready' ? `<section class="resume-ai-review"><div class="card-head"><div><span class="eyebrow">AI resume-specific review</span><h3>Detailed analysis</h3></div><span class="badge blue">${esc(ai.model || 'AI')}</span></div><p>${esc(ai.summary)}</p>${ai.experience_feedback ? `<p><b>Experience:</b> ${esc(ai.experience_feedback)}</p>` : ''}${ai.education_feedback ? `<p><b>Education:</b> ${esc(ai.education_feedback)}</p>` : ''}</section>` : `<p class="muted resume-ai-status">${esc(ai.message || 'AI-specific review is unavailable. The evidence-based resume analysis is shown below.')}</p>`}
        ${evidence('Education', list(analysis.education).length ? analysis.education : analysis.qualifications)}
        ${evidence('Work experience', analysis.experience)}
        ${evidence('Internships', analysis.internships)}
        ${evidence('Projects', analysis.projects)}
        ${evidence('Certifications', analysis.certifications)}
        ${evidence('Technical knowledge extracted', analysis.technical_knowledge || analysis.detected_skills)}
        <section class="resume-report-section"><h3>Prioritized learning roadmap</h3>${roadmap.length ? roadmap.map((step, index) => `<article class="resume-roadmap-step"><div class="card-head"><h4>${index + 1}. ${esc(step.skill)}</h4><span class="badge ${step.priority === 'High' ? 'warning' : 'blue'}">${esc(step.priority)}</span></div><p class="muted">${esc(step.reason)}</p><p><b>Project:</b> ${esc(step.project)}</p><p><b>Practical exercise:</b> ${esc(step.exercise)}</p>${list(step.courses).length ? `<div><b>Relevant courses:</b><div class="account-link-list">${step.courses.map(course => `<p>${courseLink(course)} <small class="muted">${esc(course.level)} · ${esc(course.duration)}</small></p>`).join('')}</div></div>` : '<small class="muted">No matching course is in the current learning catalogue.</small>'}</article>`).join('') : '<p class="muted">No skill gaps were identified for this target. Use the matched-skill evidence to choose a next project.</p>'}</section>
        <p class="muted" style="font-size:.76rem;margin-top:18px">${esc(analysis.note || 'Review extracted details for accuracy.')} · ${Number(analysis.word_count || 0)} words processed.</p>
      </article>`;
    })() : '<article class="card resume-placeholder" id="resume-view"><h3>Your analysis report will appear here</h3><p class="muted">Upload a resume and analyze it to see extracted evidence and role-specific skill gaps.</p></article>';

    return `${heading('Resume analysis','Upload a resume to extract evidence, compare role skills, and get a personalized improvement plan.')}<div class="grid grid-main"><div class="grid"><form class="card" id="resume-upload" data-form="resume-analyze" enctype="multipart/form-data"><div class="card-head"><h3>Analyze your resume</h3><span class="badge blue">PDF · DOCX · DOC · 10 MB max</span></div><p class="muted" style="font-size:.83rem">Text is extracted on the CAMPUSLINK backend. For the AI-specific review, email addresses and phone numbers are redacted before resume content is sent to the configured Groq service.</p><div class="field"><label>Resume file</label><input type="file" name="file" accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"><small>${analysis ? `Current resume: ${esc(analysis.filename)}. Choose a new file to replace it.` : 'Select a PDF or Word document, up to 10 MB.'}</small></div><div class="field"><label>Compare with a vacancy</label><select name="selected_job_id"><option value="">Use my career goal or the job description below</option>${jobs.map(job => `<option value="${job.id}" ${String(job.id) === selectedJob ? 'selected' : ''}>${esc(job.title)} · ${esc(job.company)}</option>`).join('')}</select></div><div class="field"><label>Paste job description (optional)</label><textarea name="job_description" maxlength="12000" placeholder="Paste the role description and requirements here"></textarea></div><div class="field"><label>Or upload a job description file</label><input type="file" name="job_description_file" accept=".txt,.pdf,.docx,.doc,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"><small>PDF, DOCX, DOC, or UTF-8 TXT · 2 MB max.</small></div><button class="btn btn-primary" type="submit">Analyze resume</button></form>${report}</div><aside class="card"><div class="card-head"><h3>What the report includes</h3></div><ul style="padding-left:19px;color:#5f7286;font-size:.84rem;line-height:1.9"><li>Education, experience, projects, and certifications</li><li>Matched, partial, missing, and additional skills</li><li>Role-specific skill match percentage</li><li>Resume-specific AI strengths and gaps</li><li>Prioritized courses, projects, and practical exercises</li></ul><div class="match-explain" style="margin-top:18px"><b>Document and privacy notes</b><p style="font-size:.78rem;margin:5px 0 0">Scanned PDFs without selectable text need OCR; OCR is not configured, so upload a text-based file. Resume files are private to your account. Email addresses and phone numbers are redacted before resume text is sent to Groq for its specific review.</p></div></aside></div>`;
  }

  async function recommendationsPage() {
    const d=await api('/student/skill-recommendations');
    state.skillRecommendations=d;
    if(state.profile){state.profile={...state.profile,career_goal:d.career_goal,skills:d.current_skills};}
    const careerCards=d.careers.map(career=>`<button type="button" class="career-choice ${career.id===d.career_id?'is-selected':''}" data-action="select-skill-career" data-career-id="${esc(career.id)}" aria-pressed="${career.id===d.career_id}"><span class="career-choice-icon" aria-hidden="true">${esc(career.icon)}</span><span><b>${esc(career.title)}</b><small>${esc(career.subtitle)}</small></span><span class="career-choice-check" aria-hidden="true">${career.id===d.career_id?'✓':'→'}</span></button>`).join('');
    const skills=d.current_skills||[];
    const skillRows=skills.length?skills.map((skill,index)=>`<div class="skill-current-row"><div class="skill-current-copy"><b>${esc(skill.name)}</b><small data-skill-value="${index}">${skillLevelName(skill.proficiency)} · ${Number(skill.proficiency)||0}%</small></div><input type="range" min="0" max="100" step="5" value="${Math.max(0,Math.min(100,Number(skill.proficiency)||0))}" data-skill-proficiency="${index}" aria-label="${esc(skill.name)} proficiency"><button type="button" class="skill-remove" data-action="remove-career-skill" data-skill-index="${index}" aria-label="Remove ${esc(skill.name)}">×</button></div>`).join(''):empty('No current skills yet','Add a skill and choose a proficiency level to see how it maps to your target career.','⌁');
    const target=d.careers.find(career=>career.id===d.career_id);
    const missing=d.missing_skills||[];
    const partialGaps=(d.skill_gaps||[]).filter(item=>item.proficiency>0);
    const recommendations=d.recommendations||[];
    const recommendationCards=recommendations.map(item=>`<article class="card skill-rec-card" data-rec-card data-name="${esc(item.name.toLowerCase())}" data-priority="${esc(item.priority)}" data-status="${esc(item.status)}" data-gap="${item.gap}"><div class="skill-rec-card-top"><div><span class="eyebrow">${item.proficiency?`${item.proficiency}% current · ${item.target}% target`:'Role requirement'}</span><h3>${esc(item.name)}</h3></div><span class="skill-priority priority-${esc(item.priority.toLowerCase())}">${esc(item.priority)} priority</span></div><p class="skill-rec-description">${esc(item.description)}</p><p class="skill-rec-reason">${esc(item.reason||'Recommended from the selected career requirements.')}</p><div class="skill-rec-progress"><div class="skill-rec-progress-label"><span>Career skill progress</span><b>${item.proficiency}% <small>of ${item.target}% target</small></b></div><div class="progress-bg"><span style="width:${Math.min(100,Math.round(item.proficiency/item.target*100))}%"></span></div></div><div class="skill-rec-actions"><label>Learning status<select data-skill-rec-status data-career-id="${esc(d.career_id)}" data-skill="${esc(item.name)}"><option ${item.status==='Not Started'?'selected':''}>Not Started</option><option ${item.status==='In Progress'?'selected':''}>In Progress</option><option ${item.status==='Completed'?'selected':''}>Completed</option></select></label></div><div class="skill-rec-resources"><b>Learn and practice</b><div class="skill-resource-list">${item.resources.map(resource=>`<a href="${esc(resource.url)}" target="_blank" rel="noopener noreferrer"><span class="skill-resource-kind">${esc(resource.kind)}</span><span>${esc(resource.title)} <i aria-hidden="true">↗</i></span></a>`).join('')}</div><p><b>Project:</b> ${esc(item.project)}</p></div></article>`).join('');
    const roadmap=target&&d.required_skills.length?`<ol class="skill-roadmap">${[...d.required_skills].sort((a,b)=>a.order-b.order).map((item,index)=>`<li class="${item.status==='Completed'?'is-complete':''}"><span class="roadmap-step-marker">${item.status==='Completed'?'✓':index+1}</span><div class="roadmap-step-content"><div><b>${esc(item.name)}</b><span class="roadmap-step-status">${esc(item.status)}</span></div><p>${esc(item.description)}</p><small>Target proficiency · ${item.target}% · ${item.priority.toLowerCase()} priority</small></div></li>`).join('')}</ol>`:empty('Choose a career path to build your roadmap','Your roadmap will follow the selected role requirements.','⌖');
    const certificationCards=(d.certifications||[]).map(cert=>`<a class="career-certification" href="${esc(cert.url)}" target="_blank" rel="noopener noreferrer"><span class="career-cert-icon" aria-hidden="true">◇</span><span><small>${esc(cert.kind)}</small><b>${esc(cert.title)}</b></span><i aria-hidden="true">↗</i></a>`).join('');
    const careerContent=d.career_id?`<section class="skill-recommendation-overview"><article class="card skill-readiness-card"><div class="skill-readiness-ring" style="--readiness:${d.readiness}%"><span>${d.readiness}%</span></div><div><span class="eyebrow">Career readiness</span><h2>${esc(target?.title||'Selected career')}</h2><p>Weighted progress across the role’s required skills.</p></div></article><div class="skill-summary-stats"><article class="card"><span>Skill gaps</span><b>${d.skill_gaps.length}</b><small>Below target proficiency</small></article><article class="card"><span>Missing skills</span><b>${missing.length}</b><small>Not listed in your profile</small></article><article class="card"><span>In progress</span><b>${recommendations.filter(item=>item.status==='In Progress').length}</b><small>Saved learning activity</small></article></div></section>
      <section class="skill-gap-layout"><article class="card skill-gap-card"><div class="card-head"><div><span class="eyebrow">Build on what you know</span><h3>Skill gaps</h3></div><span class="badge blue">${partialGaps.length} developing</span></div>${partialGaps.length?`<div class="skill-gap-list">${partialGaps.map(item=>`<div><span><b>${esc(item.name)}</b><small>${item.proficiency}% current · ${item.target}% target</small></span><span class="skill-gap-track"><i style="width:${Math.min(100,Math.round(item.proficiency/item.target*100))}%"></i></span></div>`).join('')}</div>`:empty('No partial gaps','Your listed role skills are at or above their targets.','✓')}</article><article class="card skill-gap-card"><div class="card-head"><div><span class="eyebrow">Not listed yet</span><h3>Missing skills</h3></div><span class="badge ${missing.length?'warning':'success'}">${missing.length} missing</span></div>${missing.length?`<div class="chip-list">${missing.map(item=>`<span class="chip missing-skill-chip">${esc(item.name)}</span>`).join('')}</div><p class="muted skill-gap-note">Add a skill above when you have started learning it; the gap will update with your proficiency.</p>`:empty('No skills are missing','Your profile includes every skill in this career path.','✓')}</article></section>
      <section class="card skill-recommendation-section"><div class="card-head"><div><span class="eyebrow">Your next steps</span><h2>Recommended skills</h2><p class="muted">Recommendations use your role requirements, proficiency gap, and saved learning status.</p></div></div><div class="skill-rec-filters"><label class="skill-search-field"><span aria-hidden="true">⌕</span><input id="skill-rec-search" type="search" placeholder="Search recommended skills" aria-label="Search recommended skills"></label><label>Priority<select id="skill-rec-priority"><option value="">All priorities</option><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option></select></label><label>Status<select id="skill-rec-status-filter"><option value="">All statuses</option><option>Not Started</option><option>In Progress</option></select></label><label>Sort by<select id="skill-rec-sort"><option value="priority">Priority</option><option value="gap">Largest gap</option><option value="name">Skill name</option></select></label><button class="btn btn-secondary btn-sm" data-action="filter-skill-recommendations">Apply</button></div><div class="skill-rec-grid" id="skill-rec-grid">${recommendationCards||`<div class="skill-rec-empty">${empty('You are ready for this career path','All required skills have reached their target proficiency. Explore the recommended certification or build another project.','✦')}</div>`}</div><div id="skill-rec-filter-empty" class="skill-rec-filter-empty" hidden>${empty('No skills match these filters','Try another search, priority, or status.','⌕')}</div></section>
      <section class="grid grid-2 skill-roadmap-layout"><article class="card"><div class="card-head"><div><span class="eyebrow">A clear sequence</span><h3>Personal learning roadmap</h3></div><span class="badge blue">${target?.title||''}</span></div>${roadmap}</article><article class="card"><div class="card-head"><div><span class="eyebrow">Optional credentials</span><h3>Recommended certifications</h3></div></div><div class="career-certification-list">${certificationCards||empty('No credential listed','Follow the official course and project recommendations for this path.','◇')}</div><p class="muted skill-cert-note">Certification exams can have separate fees and prerequisites. Review the provider’s details before enrolling.</p></article></section>`:`<section class="card skill-career-empty">${empty('Choose your target career','Select a career path to compare your skills with its requirements and generate a personal roadmap.','✦')}</section>`;
    return `${heading('Skill Recommendations','A focused path from your current skills to the career you want.')}<p class="skill-system-note"><span aria-hidden="true">✦</span> ${esc(d.method)}. Your plan is based on your profile and is saved to your account.</p><section class="skill-career-section"><div class="skill-section-heading"><div><span class="eyebrow">Choose a direction</span><h2>Career goal</h2></div>${d.career_id?`<span class="badge blue">Current goal · ${esc(target?.title||d.career_goal)}</span>`:'<span class="badge warning">Choose a target</span>'}</div><div class="career-choice-grid">${careerCards}</div></section><section class="skill-profile-layout"><article class="card skill-current-card"><div class="card-head"><div><span class="eyebrow">Your starting point</span><h3>Current skills</h3></div><span class="badge blue">${skills.length} listed</span></div>${skillRows}<form class="skill-add-form" data-form="career-skill-add"><label><span class="visually-hidden">Skill name</span><input name="name" maxlength="100" placeholder="Add a skill, e.g. JavaScript" required></label><label><span class="visually-hidden">Proficiency level</span><select name="proficiency" aria-label="Skill proficiency"><option value="25">Beginner · 25%</option><option value="60" selected>Intermediate · 60%</option><option value="90">Advanced · 90%</option></select></label><button class="btn btn-primary btn-sm" type="submit">Add skill</button></form><p class="muted skill-current-hint">Move a slider to update and save your proficiency. Beginner, intermediate, and advanced levels map to 25%, 60%, and 90%.</p></article><aside class="card skill-profile-note"><span class="skill-note-icon" aria-hidden="true">⌁</span><span class="eyebrow">Profile based</span><h3>Your skills stay yours</h3><p>Skills, career goals, and roadmap progress are saved to your authenticated student profile. Refresh anytime to continue.</p><a href="#profile?section=skills">Manage your full profile <span aria-hidden="true">→</span></a></aside></section>${careerContent}`;
  }

  function skillLevelName(value) {
    const level=Number(value)||0;
    return level>=80?'Advanced':level>=50?'Intermediate':level>0?'Beginner':'Not started';
  }

  function saveSkillRecommendationResponse(result) {
    state.skillRecommendations=result;
    if(state.profile)state.profile={...state.profile,career_goal:result.career_goal,skills:result.current_skills};
  }

  async function persistSkillRecommendationSkills(skills) {
    const body={skills};
    const careerId=state.skillRecommendations?.career_id;
    if(careerId)body.career_id=careerId;
    const result=await api('/student/skill-recommendations',{method:'PUT',body});
    saveSkillRecommendationResponse(result);
    return result;
  }

  function applySkillRecommendationFilters() {
    const grid=$('#skill-rec-grid');if(!grid)return;
    const query=($('#skill-rec-search')?.value||'').trim().toLowerCase();
    const priority=$('#skill-rec-priority')?.value||'';
    const status=$('#skill-rec-status-filter')?.value||'';
    const sort=$('#skill-rec-sort')?.value||'priority';
    const priorityOrder={HIGH:0,MEDIUM:1,LOW:2};
    const cards=[...grid.querySelectorAll('[data-rec-card]')];
    cards.sort((a,b)=>sort==='name'?a.dataset.name.localeCompare(b.dataset.name):sort==='gap'?Number(b.dataset.gap)-Number(a.dataset.gap):priorityOrder[a.dataset.priority]-priorityOrder[b.dataset.priority]||a.dataset.name.localeCompare(b.dataset.name));
    cards.forEach(card=>{const visible=(!query||card.dataset.name.includes(query))&&(!priority||card.dataset.priority===priority)&&(!status||card.dataset.status===status);card.hidden=!visible;grid.append(card);});
    const emptyResult=$('#skill-rec-filter-empty');
    if(cards.length&&emptyResult)emptyResult.hidden=cards.some(card=>!card.hidden);
  }

  async function quizzesPage() {
    if (state.quiz?.active && (!state.quiz.custom || quickQuizHydrated)) return quizTakingHtml();
    if (state.quiz?.result) return quizResultHtml();
    const [quick, banks, results]=await Promise.all([api('/quizzes/quick/options'),api('/quizzes'),api('/quiz-results').catch(()=>({items:[]}))]);
    state.quickQuizOptions=quick;
    const dailyStatus=quick.daily?.status||'';
    const dailyNotice=quick.daily?.used
      ? '<div class="match-explain" role="status" style="margin:14px 0">You have used today’s Quick Quiz. Your next quiz is available on <b>'+esc(dateText(quick.daily.next_eligible_date))+'</b>.</div>'
      : dailyStatus==='GENERATING'
        ? '<div class="match-explain" role="status" style="margin:14px 0">Your AI quiz is being prepared. Refresh this page in a few seconds.</div>'
        : '';
    const attempt=quick.active_attempt;
    if(attempt?.quiz){
      const answers=attempt.answers||{};
      const firstUnanswered=attempt.questions.findIndex(question=>!Object.prototype.hasOwnProperty.call(answers,question.id));
      state.quiz={...attempt.quiz,questions:attempt.questions,answers,feedback:{},active:true,result:null,custom:true,index:firstUnanswered<0?attempt.questions.length-1:firstUnanswered,seconds:attempt.quiz.duration_minutes*60,ends_at:Date.now()+attempt.quiz.duration_minutes*60*1000,progress_revision:Number(attempt.quiz.attempt_revision||0)};
      quickQuizHydrated=true;persistActiveQuiz();return quizTakingHtml();
    }
    if(state.quiz?.active&&state.quiz.custom){clearInterval(state.quiz.timer);state.quiz=null;quickQuizHydrated=false;sessionStorage.removeItem('campuslink_quiz_attempt');}
    const visibleBanks=banks.items.filter(item=>(quick.branch_categories||[]).includes(item.category));
    const routeParams=new URLSearchParams(state.routeQuery||'');
    const categoryHint=(routeParams.get('category')||'').toLowerCase();
    const quizCategory=categoryHint
      ? quick.categories.find(category=>category.toLowerCase()===categoryHint)||quick.categories.find(category=>category.toLowerCase().includes(categoryHint))||'Mixed'
      : 'Mixed';
    const quizTopic=routeParams.get('topic')||'';
    const minimum=Number(quick.min_questions)||3;
    const defaultDifficulty=quick.recommended_difficulty||['Medium','Easy','Hard'].find(level=>Number(quick.availability?.[quizCategory]?.[level]||0)>=minimum)||'Medium';
    const initialCounts=(quick.daily?.used||['GENERATING','IN_PROGRESS'].includes(quick.daily?.status))?[]:quickQuizCountChoices(quick,quizCategory,'Adaptive');
    const currentCount=initialCounts.includes(10)?10:(initialCounts.at(-1)||'');
    const available=Number(quick.availability?.[quizCategory]?.[defaultDifficulty]||0);
    const countMessage=dailyNotice?'Daily Quick Quiz limit reached.':initialCounts.length
      ? `${available} ${quizDifficultyLabel(defaultDifficulty).toLowerCase()} AI-generated questions can be requested at this level.`
      : `Only ${available} ${quizDifficultyLabel(defaultDifficulty).toLowerCase()} questions available. Choose another difficulty or category with at least ${minimum}.`;
    const countOptions=initialCounts.length
      ? initialCounts.map(x=>`<option value="${x}" ${x===currentCount?'selected':''}>${x} questions</option>`).join('')
      : '<option value="" selected>No available counts</option>';
    return `${heading('Quick skill quiz','Generate a fresh AI quiz and review all answers after submission.')}<article class="card quick-quiz-card"><div class="quick-quiz-intro"><div><span class="eyebrow">AI-generated practice · ${esc(quick.branch)}</span><h2 style="margin:5px 0">Build a focused quiz</h2><p class="muted" style="margin:0">Choose a topic, difficulty, and question count. Your answers are saved so you can resume after a refresh.</p></div><span class="metric-icon teal">✓</span></div>${dailyNotice}<form data-form="quick-quiz-start" class="quick-quiz-controls"><div class="field"><label for="quick-quiz-category">Category</label><select id="quick-quiz-category" name="category">${['Mixed',...quick.categories].map(x=>`<option value="${esc(x)}" ${x===quizCategory?'selected':''}>${esc(x)}</option>`).join('')}</select></div><div class="field"><label for="quick-quiz-topic">Focus topic (optional)</label><input id="quick-quiz-topic" name="topic" maxlength="120" value="${esc(quizTopic)}" placeholder="e.g. Python decorators, SQL joins"></div><div class="field"><label for="quick-quiz-difficulty">Difficulty</label><select id="quick-quiz-difficulty" name="difficulty"><option value="Adaptive" selected>Adaptive · suggested ${esc(quizDifficultyLabel(defaultDifficulty))}</option>${[['Easy','Beginner'],['Medium','Intermediate'],['Hard','Advanced']].map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></div><div class="field"><label for="quick-quiz-count">Question count</label><select id="quick-quiz-count" name="count" required ${initialCounts.length?'':'disabled'}>${countOptions}</select></div><div class="quick-quiz-start"><small id="quick-quiz-availability" aria-live="polite">${esc(countMessage)}</small><button class="btn btn-primary" type="submit" ${initialCounts.length?'':'disabled'}>Generate Quick Quiz →</button></div></form></article><h2 class="section-subtitle">Curated practice banks</h2><div class="grid grid-3">${visibleBanks.map(q=>`<article class="card"><div class="metric-icon teal">✓</div><span class="eyebrow" style="display:block;margin-top:14px">${esc(q.category)}</span><h3 style="margin:5px 0 8px">${esc(q.title)}</h3><p class="muted" style="font-size:.81rem">${q.question_count} questions · ${q.duration_minutes} minutes</p><button class="btn btn-secondary btn-sm" data-action="start-quiz" data-id="${q.id}">Start quiz →</button></article>`).join('')}</div><article class="card" id="quizzes-scores" style="margin-top:16px"><div class="card-head"><h3>Recent results</h3></div>${results.items.length?`<div class="table-wrap"><table><thead><tr><th>Quiz</th><th>Category</th><th>Score</th><th>Date</th><th>Weak areas</th></tr></thead><tbody>${results.items.slice(0,8).map(r=>`<tr><td>${esc(r.quiz)}</td><td>${esc(r.category)}</td><td><b>${r.score}%</b></td><td>${dateText(r.created_at)}</td><td>${esc((r.weak_areas||[]).slice(0,2).join(' · ')||'—')}</td></tr>`).join('')}</tbody></table></div>`:empty('No quiz results yet','Take a quick quiz to start your preparation record.','✓')}</article>`;
  }
  function recoveryDetailsForm() {
    const configured = Boolean(state.user?.date_of_birth_configured);
    return `<form class="card" id="profile-date-of-birth" data-form="recovery-details" style="margin-top:16px"><div class="card-head"><h3>Account recovery details</h3><span class="badge ${configured?'success':'warning'}">${configured?'DOB saved':'Setup required'}</span></div><p class="muted">${configured?'Enter your date of birth again only if you need to update your recovery details.':'Add your date of birth while signed in so you can use password recovery later.'} Your current password is required to save changes.</p><div class="form-grid"><div class="field"><label for="recovery-date-of-birth">Date of birth</label><input id="recovery-date-of-birth" name="date_of_birth" type="date" autocomplete="off" required></div><div class="field"><label for="recovery-current-password">Current password</label><input id="recovery-current-password" name="current_password" type="password" autocomplete="current-password" required></div></div><button class="btn btn-secondary" type="submit">Save recovery details</button></form>`;
  }
  function quickQuizCountChoices(options, category, difficulty) {
    const effectiveDifficulty=difficulty==='Adaptive'?(options?.recommended_difficulty||'Medium'):difficulty;
    const available=Number(options?.availability?.[category]?.[effectiveDifficulty]||0);
    const minimum=Number(options?.min_questions)||3;
    const topic=String($('#quick-quiz-topic')?.value||'').trim();
    const maximum=Math.min(Number(options?.max_questions)||15,topic?Number(options?.max_questions)||15:available);
    if(available<minimum)return [];
    return [...new Set([minimum,5,10,maximum].filter(count=>count>=minimum&&count<=maximum))].sort((a,b)=>a-b);
  }
  const quizDifficultyLabel = level => ({Easy:'Beginner',Medium:'Intermediate',Hard:'Advanced'}[level]||level||'Intermediate');
  function syncQuickQuizCount(form, options) {
    const category=$('select[name="category"]',form)?.value;
    const difficulty=$('select[name="difficulty"]',form)?.value;
    const countSelect=$('select[name="count"]',form);
    if(!category||!difficulty||!countSelect)return;
    const previous=Number(countSelect.value);
    const choices=quickQuizCountChoices(options,category,difficulty);
    countSelect.innerHTML=choices.length
      ? choices.map(value=>`<option value="${value}">${value} questions</option>`).join('')
      : '<option value="" selected>No available counts</option>';
    const selected=choices.includes(previous)?previous:(choices.includes(10)?10:(choices.at(-1)||''));
    countSelect.value=selected;
    const dailyLocked=Boolean(options.daily?.used)||['GENERATING','IN_PROGRESS'].includes(options.daily?.status);
    countSelect.disabled=choices.length===0||dailyLocked;
    const effectiveDifficulty=difficulty==='Adaptive'?(options?.recommended_difficulty||'Medium'):difficulty;
    const available=Number(options.availability?.[category]?.[effectiveDifficulty]||0);
    const topic=String($('input[name="topic"]',form)?.value||'').trim();
    const minimum=Number(options.min_questions)||3;
    const message=$('#quick-quiz-availability',form);
    if(message)message.textContent=choices.length
      ? ('AI can generate up to '+options.max_questions+' '+quizDifficultyLabel(effectiveDifficulty).toLowerCase()+' questions'+(topic?' for '+topic:'')+'.')
      : 'AI quiz question counts are unavailable. Refresh and try again.';
    const submit=$('button[type="submit"]',form);
    if(submit)submit.disabled=choices.length===0||dailyLocked;
  }
  function quizTakingHtml() {
    const q=state.quiz; const minutes=String(Math.floor(q.seconds/60)).padStart(2,'0'), seconds=String(q.seconds%60).padStart(2,'0');
    const question=q.questions[q.index], multiple=question.question_type==='MULTIPLE_ANSWER';
    const chosen=q.answers[question.id], chosenList=Array.isArray(chosen)?chosen:[chosen];
    const feedback=q.feedback?.[question.id];
    const progress=Math.round((q.index+1)/q.questions.length*100);
    const feedbackHtml=feedback?`<div class="quiz-feedback ${feedback.correct?'quiz-feedback-correct':'quiz-feedback-incorrect'}" role="status"><b>${feedback.correct?'Correct':'Not quite'}.</b> ${feedback.correct?'Your answer matches the key concept.':`Correct answer: ${feedback.correct_options.map(esc).join(', ')}.`}<p>${esc(feedback.explanation)}</p></div>`:'';
    const finalAction=state.quiz.custom
      ? '<button class="btn btn-primary" type="submit">Submit quiz</button>'
      : chosen!==undefined&&!feedback
      ? '<button class="btn btn-primary" type="button" data-action="quiz-check">Check answer</button>'
      : '<button class="btn btn-primary" type="submit">Submit quiz</button>';
    return `${heading(q.title,`${q.category} · ${q.questions.length} questions · ${q.index+1} of ${q.questions.length}`,`<span class="timer" id="quiz-clock">${minutes}:${seconds}</span>`)}${q.topic_notice?`<p class="card muted" role="status">${esc(q.topic_notice)}</p>`:''}<form class="card" data-form="quiz-submit"><div class="quiz-progress" role="progressbar" aria-label="Quiz progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><span style="width:${progress}%"></span></div><div class="card-head"><span class="badge blue">Question ${q.index+1} / ${q.questions.length}</span><span class="muted" style="font-size:.8rem">${multiple?'Select all correct answers':'Select one answer'}</span></div><div class="eyebrow">${esc(question.topic||question.category||q.category)} · ${esc(quizDifficultyLabel(question.difficulty||q.difficulty))} · ${esc((question.question_type||'MCQ').replaceAll('_',' '))}</div><h2 style="font-size:1.25rem;margin:9px 0 20px">${esc(question.prompt)}</h2>${question.options.map((o,i)=>`<label class="quiz-option"><input type="${multiple?'checkbox':'radio'}" name="choice" value="${i}" ${chosenList.includes(i)?'checked':''}><span>${esc(o)}</span></label>`).join('')}${feedbackHtml}<div class="form-actions" style="justify-content:space-between"><button class="btn btn-secondary" type="button" data-action="quiz-prev" ${q.index===0?'disabled':''}>← Previous</button>${q.index<q.questions.length-1?`<button class="btn btn-primary" type="button" data-action="quiz-next">${state.quiz.custom?'Next question →':chosen!==undefined&&!feedback?'Check answer':'Next question →'}</button>`:finalAction}</div></form>`;
  }
  function quizResultHtml() {
    const r=state.quiz.result;
    const nextEligibleNotice=r.next_eligible_date
      ? '<p class="muted">Your next Quick Quiz is available on <b>'+esc(dateText(r.next_eligible_date))+'</b>.</p>'
      : '';
    const elapsed = Number(r.elapsed_seconds);
    const elapsedLabel = Number.isFinite(elapsed) ? `${Math.floor(elapsed / 60)}m ${elapsed % 60}s` : '';
    const answerText=(options,indices)=>Array.isArray(indices)?(indices.map(index=>options?.[index]).filter(Boolean).join(', ')||'Not answered'):(options?.[indices]??'Not answered');
    return `${heading('Quiz results','A practice result to help guide your next study session.')}<article class="card" style="max-width:900px;margin:auto;text-align:center"><div class="ring" style="--progress:${r.score};margin:8px auto 17px"><strong>${r.score}%</strong></div><span class="eyebrow">${esc(r.skill_level)} level${r.difficulty?` · ${esc(quizDifficultyLabel(r.difficulty))} difficulty`:''}</span><h2 style="margin:8px 0">${r.correct} correct · ${r.incorrect} incorrect · ${r.total||state.quiz.questions.length} questions</h2><p class="muted">This is a practice assessment and does not determine job eligibility.</p>${nextEligibleNotice}${elapsedLabel?`<p class="muted">Completed in ${esc(elapsedLabel)} · ${esc(r.accuracy??r.score)}% accuracy</p>`:''}${r.topic_scores?.length?`<h3 style="text-align:left;margin:20px 0 8px">Topic performance</h3><div class="topic-score-grid">${r.topic_scores.map(x=>`<div><span>${esc(x.category)}</span><b>${x.score}%</b><small>${x.correct}/${x.total} correct</small></div>`).join('')}</div>`:''}${r.difficulty_scores?.length?`<h3 style="text-align:left;margin:18px 0 8px">Difficulty performance</h3><div class="topic-score-grid">${r.difficulty_scores.map(x=>`<div><span>${esc(quizDifficultyLabel(x.difficulty))}</span><b>${x.score}%</b><small>${x.correct}/${x.total} correct</small></div>`).join('')}</div>`:''}<div class="match-explain" style="text-align:left;margin:22px 0"><h4>Strengths</h4>${r.strengths?.length?`<div class="chip-list">${r.strengths.map(x=>`<span class="chip">${esc(x)}</span>`).join('')}</div>`:'<p class="muted">Keep practicing to identify consistent strengths.</p>'}<h4 style="margin-top:15px">Needs more practice</h4>${r.weak_areas?.length?`<ul>${r.weak_areas.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<p style="margin:0">No weak areas stood out in this attempt.</p>'}${r.recommendations?.length?`<h4 style="margin-top:15px">Next steps</h4><ul>${r.recommendations.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}</div><div style="text-align:left"><h3>Answer review</h3>${r.answers.map(ans=>{const q=state.quiz.questions.find(x=>x.id===ans.question_id),chosen=ans.chosen_indices??state.quiz.answers[ans.question_id],correct=ans.correct_indices??[ans.correct_index];return `<div style="padding:12px 0;border-bottom:1px solid var(--line)"><span class="eyebrow">${esc(q?.topic||q?.category||'Topic')} · ${esc(quizDifficultyLabel(q?.difficulty||'Medium'))}</span><b style="display:block;margin:5px 0">${esc(q?.prompt||'Question')}</b><div style="font-size:.82rem;margin-top:5px">Your answer: ${esc(answerText(q?.options,chosen))} ${ans.correct?'✓':'· Incorrect'}<br>Correct answer: <b>${esc(answerText(q?.options,correct))}</b></div><small class="muted">${esc(ans.explanation)}</small></div>`;}).join('')}</div><button class="btn btn-primary" style="margin-top:18px" data-action="quiz-done">Back to quizzes</button></article>`;
  }
  function persistActiveQuiz() {
    if(!state.quiz?.active||!state.user)return;
    try { sessionStorage.setItem('campuslink_quiz_attempt',JSON.stringify({user_id:state.user.id,quiz:state.quiz})); } catch {}
  }
  function restoreActiveQuiz() {
    try {
      const saved=JSON.parse(sessionStorage.getItem('campuslink_quiz_attempt')||'null');
      if(saved?.user_id===state.user?.id&&saved.quiz?.active&&Array.isArray(saved.quiz.questions)&&saved.quiz.attempt_token){
        state.quiz=saved.quiz;state.quiz.timer=null;state.quiz.seconds=Math.max(0,Math.ceil(((Number(state.quiz.ends_at)||Date.now())-Date.now())/1000));
      }
    } catch { sessionStorage.removeItem('campuslink_quiz_attempt'); }
  }
  function startQuizTimer() {
    clearInterval(state.quiz.timer); state.quiz.timer=setInterval(()=>{if(!state.quiz?.active)return;state.quiz.seconds=Math.max(0,Math.ceil(((Number(state.quiz.ends_at)||Date.now())-Date.now())/1000));const clock=$('#quiz-clock');if(clock)clock.textContent=`${String(Math.floor(Math.max(0,state.quiz.seconds)/60)).padStart(2,'0')}:${String(Math.max(0,state.quiz.seconds)%60).padStart(2,'0')}`;persistActiveQuiz();if(state.quiz.seconds<=0){clearInterval(state.quiz.timer);submitCurrentQuiz();}},1000);
  }
  function captureCurrentQuizAnswer(form=$('form[data-form="quiz-submit"]')) {
    if(!state.quiz?.active||!form)return;
    const question=state.quiz.questions[state.quiz.index];
    const previousAnswer=state.quiz.answers[question.id];
    const selected=[...form.querySelectorAll('input[name="choice"]:checked')].map(input=>Number(input.value));
    const nextAnswer=question.question_type==='MULTIPLE_ANSWER'?selected.sort((a,b)=>a-b):selected[0];
    if(selected.length)state.quiz.answers[question.id]=nextAnswer;
    else delete state.quiz.answers[question.id];
    const changed=JSON.stringify(nextAnswer)!==JSON.stringify(previousAnswer);
    if(changed&&state.quiz.feedback)delete state.quiz.feedback[question.id];
    persistActiveQuiz();
    if(changed&&state.quiz.custom)saveQuickQuizProgress();
  }
  async function saveQuickQuizProgress() {
    const quiz=state.quiz;
    if(!quiz?.active||!quiz.custom)return;
    const token=quiz.attempt_token;
    const revision=(Number(quiz.progress_revision)||0)+1;
    quiz.progress_revision=revision;
    try {
      const result=await api('/quizzes/quick/progress',{method:'POST',body:{attempt_token:token,answers:{...quiz.answers},revision}});
      if(state.quiz?.attempt_token===token)state.quiz.progress_revision=Math.max(Number(state.quiz.progress_revision)||0,Number(result.revision)||revision);
    } catch {
      if(state.quiz?.attempt_token===token&&!quiz.progressWarningShown){
        quiz.progressWarningShown=true;
        toast('Your latest answer could not be synced. Keep this tab open and submit the quiz to save it.','error');
      }
    }
  }
  async function checkCurrentQuizAnswer() {
    if(!state.quiz?.active)return;
    captureCurrentQuizAnswer();
    const question=state.quiz.questions[state.quiz.index];
    const answer=state.quiz.answers[question.id];
    if(answer===undefined){toast('Choose an answer to see the explanation.','error');return;}
    const {feedback}=await api('/quizzes/answer-feedback',{method:'POST',body:{attempt_token:state.quiz.attempt_token,question_id:question.id,answer}});
    state.quiz.feedback ||= {};
    state.quiz.feedback[question.id]=feedback;
    persistActiveQuiz();
    renderPage('quizzes');
  }
  async function submitCurrentQuiz() {
    if(!state.quiz?.active)return;
    const {result}=state.quiz.custom
      ? await api('/quizzes/quick/submit',{method:'POST',body:{attempt_token:state.quiz.attempt_token,answers:state.quiz.answers}})
      : await api(`/quizzes/${state.quiz.id}/submit`,{method:'POST',body:{attempt_token:state.quiz.attempt_token,answers:state.quiz.answers}});
    clearInterval(state.quiz.timer);state.quiz.active=false;state.quiz.result=result;sessionStorage.removeItem('campuslink_quiz_attempt');renderPage('quizzes');
  }

  function interviewPage() {
    const routeCategory=new URLSearchParams(state.routeQuery||'').get('category');
    if (!state.interview) return `${heading('Mock interview','Practice with a local question bank and automated text feedback.')}<article class="card" style="max-width:760px"><span class="eyebrow">Automated Practice Assessment</span><h2 style="margin-top:7px">Choose a practice category</h2><p class="muted">Questions and evaluation run locally. Feedback covers expected keyword overlap and answer structure.</p><form data-form="interview-start"><div class="field"><label>Interview category</label><select name="category">${['General','Technical','Python','Java','SQL','Data Structures','Machine Learning','HR'].map(x=>`<option ${x.toLowerCase()===(routeCategory||'').toLowerCase()?'selected':''}>${x}</option>`).join('')}</select></div><button class="btn btn-primary">Start practice interview →</button></form><div class="match-explain" style="margin-top:20px"><b>What gets assessed</b><p style="margin:5px 0 0;font-size:.8rem">Technical keyword coverage · Answer relevance · Communication structure · Suggested improvements</p></div></article>`;
    return interviewTakingHtml();
  }
  function interviewTakingHtml() {
    const x=state.interview; const q=x.questions[x.index];
    if (!q) return `${heading('Practice interview complete','Review feedback from your answers.')}${x.final?`<article class="card"><span class="badge blue">${esc(x.final.label)}</span><div class="grid grid-4" style="margin:16px 0">${metric('Technical score',`${x.final.technical_score}%`,'⌁')}${metric('Relevance',`${x.final.relevance_score}%`,'◎','teal')}${metric('Communication',`${x.final.communication_score}%`,'◉','green')}${metric('Overall practice score',`${x.final.overall_score}%`,'✓','amber')}</div><p class="muted" style="font-size:.8rem">These are automated practice indicators, not a hiring decision.</p>${x.results.map((r,i)=>`<div style="padding:15px 0;border-bottom:1px solid var(--line)"><span class="badge blue">Question ${i+1}</span><h3 style="margin-top:8px">${esc(r.question)}</h3><div class="grid grid-3"><div><span class="muted">Relevance</span><div class="score">${r.relevance_score}%</div></div><div><span class="muted">Communication</span><div class="score">${r.communication_score}%</div></div><div><span class="muted">Feedback</span><div style="font-size:.82rem">${esc(r.feedback)}</div></div></div></div>`).join('')}<button class="btn btn-primary" style="margin-top:17px" data-action="interview-done">Start another practice</button></article>`:`<article class="card">${x.results.map((r,i)=>`<div style="padding:15px 0;border-bottom:1px solid var(--line)"><span class="badge blue">Question ${i+1}</span><h3 style="margin-top:8px">${esc(r.question)}</h3><div class="grid grid-3"><div><span class="muted">Relevance</span><div class="score">${r.relevance_score}%</div></div><div><span class="muted">Communication</span><div class="score">${r.communication_score}%</div></div><div><span class="muted">Feedback</span><div style="font-size:.82rem">${esc(r.feedback)}</div></div></div></div>`).join('')}<button class="btn btn-primary" style="margin-top:17px" data-action="interview-done">Finish and score practice</button></article>`}`;
    return `${heading(`${esc(x.category)} practice interview`,`Question ${x.index+1} of ${x.questions.length}`, '<span class="badge blue">Automated Practice Assessment</span>')}<article class="card" style="max-width:850px"><span class="eyebrow">Question ${x.index+1}</span><h2 style="font-size:1.3rem;margin-top:7px">${esc(q.prompt)}</h2><form data-form="interview-answer"><input type="hidden" name="question_id" value="${q.id}"><div class="field"><label>Your answer</label><textarea name="answer" required minlength="3" rows="6" placeholder="Structure your answer with a clear example…"></textarea><small>Practice feedback is automated and should be reviewed as guidance.</small></div><button class="btn btn-primary">Submit answer & get feedback →</button></form></article>`;
  }

  const communicationModes = {
    daily: { label: 'Daily Conversation', description: 'Build confidence in everyday conversations.' },
    interview: { label: 'Interview Practice', description: 'Practice branch-aware interview questions and follow-ups.' },
    professional: { label: 'Professional Communication', description: 'Try workplace, HR, presentation and team scenarios.' },
    vocabulary: { label: 'Vocabulary Practice', description: 'Learn useful words and use them in your own sentences.' },
    grammar: { label: 'Grammar Practice', description: 'Improve sentence formation with kind, clear corrections.' }
  };
  const communicationModeLabel = mode => communicationModes[mode]?.label || communicationModes.daily.label;
  function communicationPage() {
    const practice = state.communicationCoach;
    const requestedMode=new URLSearchParams(state.routeQuery||'').get('mode');
    if(!practice.active&&!practice.report&&requestedMode&&communicationModes[requestedMode])practice.mode=requestedMode;
    const report = practice.report;
    const modeOptions = Object.entries(communicationModes).map(([id, mode]) => `<option value="${id}" ${practice.mode === id ? 'selected' : ''}>${mode.label}</option>`).join('');
    const transcript = practice.messages.map(message => {
      const mine = message.role === 'user';
      const coachingDetails = !mine && (message.corrected_version || message.better_response || message.mistake_explanations?.length || message.vocabulary_suggestions?.length)
        ? `<div class="coach-corrections">${message.corrected_version ? `<p><b>Corrected version</b> ${esc(message.corrected_version)}</p>` : ''}${message.mistake_explanations?.length ? `<ul>${message.mistake_explanations.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : ''}${message.better_response ? `<p><b>More natural response</b> ${esc(message.better_response)}</p>` : ''}${message.vocabulary_suggestions?.length ? `<p><b>Try these words</b> ${message.vocabulary_suggestions.map(esc).join(', ')}</p>` : ''}</div>`
        : '';
      const evaluation = !mine && message.evaluation ? `<div class="coach-evaluation"><div class="coach-evaluation-scores">${[['Grammar','grammar'],['Vocabulary','vocabulary'],['Clarity','clarity'],['Fluency','fluency'],['Overall','overall']].filter(([,key])=>message.evaluation[key] != null).map(([label,key])=>`<span><b>${label}</b> ${esc(message.evaluation[key])}/10</span>`).join('')}</div>${message.evaluation.note?`<p>${esc(message.evaluation.note)}</p>`:''}</div>` : '';
      return `<div class="coach-bubble ${mine?'coach-bubble-user':'coach-bubble-ai'}"><small>${mine?'You':'English coach'}</small><div class="coach-bubble-text">${esc(message.display || message.text).replace(/\n/g,'<br>')}</div>${evaluation}${coachingDetails}</div>`
    }).join('');
    if (report) {
      const scores = [['Overall',report.overall],['Grammar',report.grammar],['Vocabulary',report.vocabulary],['Clarity',report.clarity],['Fluency',report.fluency],['Professional communication',report.professional_communication]];
      const reportList = (title, values) => `<section class="coach-report-section"><h3>${title}</h3>${values?.length?`<ul>${values.map(item=>`<li>${esc(item)}</li>`).join('')}</ul>`:'<p class="muted">Nothing specific to add from this session.</p>'}</section>`;
      return `${heading('Communication practice','A personal English tutor for daily, academic and professional conversations.')}<article class="card coach-report"><div class="coach-session-heading"><div><span class="eyebrow">Session complete · ${esc(communicationModeLabel(practice.mode))}</span><h2 style="margin:6px 0">Communication Practice Report</h2><p class="muted">Approximate coaching feedback based on this practice session.</p></div><span class="coach-score-badge">${esc(report.overall)}<small>/10</small></span></div><div class="coach-report-scores">${scores.map(([label,value])=>`<div class="coach-report-score"><span>${label}</span><b>${esc(value)}<small>/10</small></b></div>`).join('')}</div><div class="coach-report-grid">${reportList('Strengths',report.strengths)}${reportList('Common mistakes',report.common_mistakes)}${reportList('New vocabulary',report.new_vocabulary)}${reportList('Improvement areas',report.improvement_areas)}</div><section class="coach-recommendations"><h3>Personalized next steps</h3>${report.recommendations?.length?`<ol>${report.recommendations.map(item=>`<li>${esc(item)}</li>`).join('')}</ol>`:'<p>Keep practicing in short, regular sessions.</p>'}<p class="muted">Suggested next mode: <b>${esc(communicationModeLabel(report.next_mode))}</b></p></section><button class="btn btn-primary" data-action="new-communication-practice">Practice again →</button></article>`;
    }
    if (!practice.active) {
      return `${heading('Communication practice','Practice English with a patient tutor that adapts to your answers.')}<div class="coach-start-layout"><article class="card coach-start-card"><span class="eyebrow">AI English communication coach</span><h2 style="margin-top:8px">What would you like to practice?</h2><p class="muted">Have a natural conversation, get kind corrections and finish with a personalized report.</p><form data-form="communication-coach-start"><div class="field"><label for="communication-mode">Practice mode</label><select id="communication-mode" name="mode">${modeOptions}</select><small id="communication-mode-description">${esc(communicationModes[practice.mode]?.description)}</small></div><div class="coach-start-level"><span class="metric-icon teal">↗</span><div><b>Adaptive difficulty</b><p>Starts with simple language and adjusts as you improve.</p></div></div><button class="btn btn-primary" type="submit" ${practice.busy?'disabled':''}>${practice.busy?'Starting…':'Start Practice'} <span>→</span></button>${practice.error?`<div class="coach-error" role="status"><span>${esc(practice.error)}</span><button type="button" class="btn btn-secondary btn-sm" data-action="retry-communication">Try again</button></div>`:''}</form></article><aside class="card coach-mode-guide"><h3>Choose a mode</h3>${Object.entries(communicationModes).map(([id,item])=>`<div class="coach-mode-item"><span>${esc(item.label)}</span><p>${esc(item.description)}</p></div>`).join('')}<p class="coach-privacy-note">Your practice stays in this session and is not saved as an interview or hiring score.</p></aside></div>`;
    }
    return `${heading('Communication practice','One question at a time. Take your time and answer naturally.')}<article class="card coach-session"><header class="coach-session-heading"><div><span class="eyebrow">${esc(communicationModeLabel(practice.mode))}</span><h2 style="margin:5px 0">English communication coach</h2><p class="muted">${practice.turnCount} response${practice.turnCount===1?'':'s'} · Adaptive level</p></div><div class="coach-session-controls"><span class="coach-level coach-level-${esc(practice.difficulty)}">${esc(practice.difficulty)} level</span><button class="btn btn-secondary btn-sm" type="button" data-action="end-communication-practice" ${practice.busy||practice.turnCount<1||practice.reportError?'disabled':''}>End Practice</button></div></header><div class="coach-transcript" id="communication-transcript" aria-live="polite" aria-label="Practice conversation">${transcript||'<p class="muted">Your practice conversation will appear here.</p>'}${practice.busy?'<div class="coach-typing" role="status"><i></i><i></i><i></i><span>Coach is thinking…</span></div>':''}</div>${practice.error?`<div class="coach-error" role="status"><span>${esc(practice.error)}</span><button type="button" class="btn btn-secondary btn-sm" data-action="retry-communication">Try again</button></div>`:''}${practice.reportError?`<div class="coach-error" role="status"><span>${esc(practice.reportError)}</span><button type="button" class="btn btn-secondary btn-sm" data-action="retry-communication-report">Retry report</button></div>`:''}<form class="coach-compose" data-form="communication-coach-message"><label class="sr-only" for="communication-reply">Your response</label><textarea id="communication-reply" name="message" rows="2" maxlength="1200" required placeholder="Type your response…" ${practice.busy||practice.error||practice.reportError?'disabled':''}></textarea><button class="btn btn-primary" type="submit" ${practice.busy||practice.error||practice.reportError?'disabled':''}>Send</button></form><p class="coach-privacy-note">Use short or long answers—your coach will meet you where you are.</p></article>`;
  }

  function communicationSessionMemory() {
    const practice = state.communicationCoach;
    const recentAnswers=practice.messages.filter(message=>message.role==='user'&&!message.display).map(message=>message.text||message.content||'').filter(Boolean).slice(-8).map(answer=>answer.slice(0,240));
    return { turn_count: practice.turnCount, recent_answers: recentAnswers, recent_corrections: practice.corrections.slice(-6), learned_vocabulary: practice.vocabulary.slice(-12) };
  }

  function communicationErrorMessage(error, report = false) {
    const detail=String(error?.message||'').trim();
    if(/failed to fetch|networkerror|network request failed|load failed/i.test(detail))
      return 'Sorry, the AI coach could not be reached. Check your connection and try again.';
    return detail || (report?'The report could not be prepared. Please try again.':'Sorry, I couldn’t process that response right now. Please try again.');
  }

  async function sendCommunicationPracticeRequest() {
    const practice = state.communicationCoach;
    const body = {
      mode: 'communication_coach', practice_mode: practice.mode, difficulty: practice.difficulty,
      session_memory: communicationSessionMemory(),
      messages: practice.messages.map(message => ({ role: message.role, content: message.content || message.text }))
    };
    practice.error = '';
    practice.busy = true;
    if (state.page === 'communication') renderPage('communication');
    try {
      const result = await api('/chatbot', { method: 'POST', body });
      practice.difficulty = result.difficulty || practice.difficulty;
      practice.corrections = [...new Set([...practice.corrections, ...(result.corrections || [])])].slice(-12);
      practice.vocabulary = [...new Set([...practice.vocabulary, ...(result.vocabulary_learned || [])])].slice(-20);
      practice.messages.push({ role: 'assistant', text: result.answer, evaluation: result.evaluation || null, corrections: result.corrections || [], mistake_explanations: result.mistake_explanations || [], corrected_version: result.corrected_version || '', better_response: result.better_response || '', vocabulary_suggestions: result.vocabulary_suggestions || [] });
      practice.error = '';
    } catch (error) {
      practice.error = communicationErrorMessage(error);
    } finally {
      practice.busy = false;
      if (state.page === 'communication') renderPage('communication');
    }
  }

  async function finishCommunicationPractice() {
    const practice = state.communicationCoach;
    if (practice.busy || practice.turnCount < 1) return;
    practice.busy = true;
    practice.error = '';
    practice.reportError = '';
    if (state.page === 'communication') renderPage('communication');
    const messages = practice.messages.map(message => ({ role: message.role, content: message.content || message.text }));
    messages.push({ role: 'user', content: 'Please prepare my personalized end-of-session Communication Practice Report using this conversation.' });
    try {
      const result = await api('/chatbot', { method: 'POST', body: {
        mode: 'communication_report', practice_mode: practice.mode, difficulty: practice.difficulty,
        session_memory: communicationSessionMemory(), messages
      } });
      practice.report = result.report;
      practice.active = false;
      practice.reportError = '';
    } catch (error) {
      practice.reportError = communicationErrorMessage(error,true);
    } finally {
      practice.busy = false;
      if (state.page === 'communication') renderPage('communication');
    }
  }

  async function roadmapPage() {
    const {items}=await api('/student/roadmap');
    return `${heading('Placement roadmap','A practical sequence drawn from current skill demand and your profile.')}<div class="grid">${items.map((x,i)=>`<article class="card" style="display:grid;grid-template-columns:42px minmax(0,1fr) 160px;align-items:center;gap:14px"><div class="step-number">${i+1}</div><div><h3 style="margin:0 0 5px">${esc(x.title)}</h3><div class="muted" style="font-size:.77rem">${esc(x.skill)}</div><div class="progress-bg" style="margin-top:10px"><span style="width:${x.progress}%"></span></div></div><div><label class="muted" style="font-size:.7rem">Progress · ${x.progress}%</label><input type="range" min="0" max="100" value="${x.progress}" data-progress-item="${esc(x.title)}" style="width:100%;accent-color:var(--accent-color)"><button class="btn btn-secondary btn-sm" data-action="save-progress" data-item="${esc(x.title)}">Save progress</button></div></article>`).join('')}</div><div class="match-explain" style="margin-top:16px"><b>How this roadmap is generated</b><p style="font-size:.8rem;margin:5px 0 0">CAMPUSLINK prioritizes missing skills that appear in active vacancies, then adds practice actions. Update progress as you complete each activity.</p></div>`;
  }
  async function trackerPage() {
    const p=await api('/student/preparation'); const skill=p.skills||[];
    return `${heading('Preparation tracker','A snapshot of your placement preparation evidence and activities.')}<div class="grid grid-3">${metric('Skills listed',skill.length,'⌁')}${metric('Projects',p.projects,'⌘','teal')}${metric('Certificates',p.certificates,'◇','green')}${metric('Quizzes completed',p.quizzes,'✓','amber')}${metric('Mock interviews',p.interviews,'◌')}${metric('Applications',p.applications,'↗','green')}</div><article class="card" id="tracker-skills" style="margin-top:16px"><div class="card-head"><h3>Skill proficiency</h3><a class="btn-ghost" href="#profile?section=skills">Edit profile →</a></div>${skill.length?skill.map(s=>`<div class="skill-row"><b>${esc(s.name)}</b><div class="progress-bg"><span style="width:${s.proficiency}%"></span></div><span class="muted">${s.proficiency}%</span></div>`).join(''):empty('No skills tracked','Add skills to your profile to show preparation progress.','⌁')}</article>`;
  }
  const resourceSkillMatches=(resourceText,term)=>{
    const text=String(resourceText||'').toLowerCase();const query=String(term||'').trim().toLowerCase();
    if(!query)return true;
    const aliases={
      programming:['programming','python','java','c programming','c++','javascript'],
      'c/c++':['c','c++','c programming'],
      'web development':['web','html','css','javascript'],
      'data science':['data science','pandas','numpy','scikit-learn','machine learning','sql'],
      'ai/ml':['artificial intelligence','machine learning','ai/ml','python','scikit-learn'],
      'sql/database':['sql','database','mysql','postgresql'],
      dsa:['dsa','data structures','algorithms'],
      'communication skills':['communication','english','interview']
    };
    const candidates=aliases[query]||[query];
    return candidates.some(candidate=>text.includes(candidate));
  };
  async function resourcesPage() {
    const {items}=await api('/resources');
    const requestedSkill=new URLSearchParams(state.routeQuery||'').get('skill')||'';
    const matchingItems=requestedSkill?items.filter(item=>resourceSkillMatches(`${item.skill||''} ${item.title||''}`,requestedSkill)):items;
    const title=requestedSkill?`Learning resources · ${requestedSkill}`:'Learning resources';
    return `${heading(title,'Browse the local learning catalogue for commonly requested skills.')}<div class="filter-row"><input id="resource-filter" value="${esc(requestedSkill)}" placeholder="Filter by skill"><button class="btn btn-secondary btn-sm" data-action="filter-resources">Filter</button></div><div class="grid grid-3" id="resource-cards"><div class="card resource-empty" id="resource-empty" ${items.length&&(!requestedSkill||matchingItems.length)?'hidden':''}>${empty('No matching resources yet',`There are no learning resources matching “${esc(requestedSkill)}” in the current catalogue.`,'▷')}</div>${items.map(item=>resourceCard(item,requestedSkill)).join('')}</div>`;
  }
  const resourceCard=(r,initialFilter='')=>{
    const rawUrl=typeof r.url==='string'?r.url.trim():'';
    let parsedUrl=null;
    try { if(rawUrl) parsedUrl=new URL(rawUrl,window.location.href); } catch {}
    const isHttps=parsedUrl?.protocol==='https:';
    const host=parsedUrl?.hostname.toLowerCase()||'';
    const isYouTube=host==='youtu.be'||host==='youtube.com'||host.endsWith('.youtube.com');
    const videoId=host==='youtu.be'?parsedUrl?.pathname.slice(1):parsedUrl?.searchParams.get('v');
    const isDirectVideo=isHttps&&isYouTube&&((parsedUrl.pathname==='/watch'&&/^[\w-]{11}$/.test(videoId||''))||(host==='youtu.be'&&/^\/[\w-]{11}$/.test(parsedUrl.pathname)));
    const isExternalResource=isHttps&&!isYouTube;
    const link=(isDirectVideo||isExternalResource)
      ?`<a class="btn btn-secondary btn-sm" href="${esc(parsedUrl.href)}" target="_blank" rel="noopener noreferrer">${isDirectVideo?'▶ Watch on YouTube':'Open resource ↗'}</a>`
      :'<button class="btn btn-secondary btn-sm" type="button" disabled aria-disabled="true">Resource unavailable</button>';
    const searchableText=`${r.skill||''} ${r.title||''}`;
    return `<article class="card resource-item" data-skill="${esc((r.skill||'').toLowerCase())}" data-search="${esc(searchableText.toLowerCase())}" ${resourceSkillMatches(searchableText,initialFilter)?'':'hidden'}><span class="badge blue">${esc(r.level)}</span><h3 style="margin:12px 0 5px">${esc(r.title)}</h3><p class="muted" style="font-size:.8rem">${esc(r.skill)} · ${esc(r.duration)}</p>${link}</article>`;
  };
  function readinessPage() {
    const guidance=[['Interview dressing','Choose clean, well-fitted clothing suited to the company and interview format. Keep accessories simple and check video framing for remote calls.'],['Grooming','Aim for a neat, comfortable appearance. Prepare the essentials the day before so you can focus on the conversation.'],['Body language','Sit comfortably, keep an attentive posture and use natural eye contact. Pause to think before answering.'],['Interview etiquette','Arrive or join on time, listen without interrupting, ask clarifying questions and thank the interviewers.'],['Professional communication','Lead with the main point, support it with a concrete example and explain the result. Keep language direct and respectful.'],['Workplace behaviour','Communicate progress early, follow through on commitments, seek feedback and give credit to collaborators.']];
    return `${heading('Professional readiness','Practical guidance for interviews and early workplace experiences.')}<div class="grid grid-2">${guidance.map((x,i)=>`<article class="card"><div class="feature-icon">${['◇','✦','◉','✓','↗','⌂'][i]}</div><h3>${x[0]}</h3><p class="muted" style="font-size:.85rem">${x[1]}</p></article>`).join('')}</div><div class="match-explain" style="margin-top:16px"><b>Practice note</b><p style="font-size:.8rem;margin:5px 0 0">Use these suggestions as flexible preparation guidance. Interview expectations differ across teams and roles.</p></div>`;
  }

  function chatbotPage() {
    const requestedMode=new URLSearchParams(state.routeQuery||'').get('mode');
    const validModes=['placement','technical_interview','hr_interview','aptitude_practice','coding_interview','resume_help','placement_roadmap','company_preparation','mock_interview'];
    if(requestedMode&&validModes.includes(requestedMode))state.assistantMode=requestedMode;
    const suggestions=['What should I focus on for my branch placements?','How can I improve my resume?','Start a mock interview with me.','Give me an aptitude practice question.'];
    return `${heading('Jarvis','Your CAMPUSLINK AI assistant for interview, aptitude, resume and placement guidance.')}<article class="card assistant-full-chat" style="max-width:920px"><div class="assistant-full-head"><div><span class="eyebrow">Jarvis · AI career copilot</span><p class="muted" style="margin:4px 0 0">Uses your branch, year, career goal and listed skills when available.</p></div><select id="chatbot-mode" aria-label="Assistant mode">${assistantModeOptions()}</select></div><div class="chat-box" id="chat-messages"></div><div class="chip-list" style="margin:12px 0">${suggestions.map(x=>`<button class="chip" style="border:0;cursor:pointer" data-action="chat-suggestion" data-message="${esc(x)}">${esc(x)}</button>`).join('')}</div><div class="assistant-error-main" id="chatbot-error" ${state.assistantError?'':'hidden'}>${esc(state.assistantError)}</div><form class="chat-compose" data-form="chat"><input name="message" required maxlength="2000" placeholder="Ask Jarvis about placement prep…"><button class="btn btn-primary" ${state.assistantBusy?'disabled':''}>${state.assistantBusy?'Thinking…':'Send'}</button></form><p class="muted" style="font-size:.72rem;margin-top:10px">Your question and recent turns are sent to the configured AI service with the limited profile context above. Do not include passwords or confidential personal data.</p></article>`;
  }
  function assistantModeOptions() {
    return [['placement','Placement guidance'],['technical_interview','Technical interview'],['hr_interview','HR interview'],['aptitude_practice','Aptitude practice'],['coding_interview','Coding interview'],['resume_help','Resume help'],['placement_roadmap','Placement roadmap'],['company_preparation','Company preparation'],['mock_interview','Mock interview']].map(([id,label])=>`<option value="${id}" ${state.assistantMode===id?'selected':''}>${label}</option>`).join('');
  }
  function renderChatMessages() {
    const box=$('#chat-messages'); if(!box)return;
    box.innerHTML=assistantTranscriptHtml();box.scrollTop=box.scrollHeight;
  }

  const assistantActions=[
    ['technical_interview','Technical interview','Start a technical interview for my branch. Ask one question at a time.'],
    ['hr_interview','HR interview','Start an HR interview practice. Ask one question at a time.'],
    ['aptitude_practice','Aptitude practice','Give me one placement-style aptitude question and guide me through the reasoning.'],
    ['coding_interview','Coding interview','Start a coding interview for my branch and career goal. Give one prompt at a time.'],
    ['resume_help','Resume help','Give me a practical resume improvement checklist for campus placements. Ask what you need to know.'],
    ['placement_roadmap','Placement roadmap','Make a practical 4-week placement preparation plan for my branch and career goal.'],
    ['company_preparation','Company preparation','Help me prepare for a company interview. Ask me for the company and role, and distinguish general advice from verified facts.'],
    ['mock_interview','Mock interview','Start a branch-aware mock interview. Ask me the first question and wait for my answer.'],
  ];
  function assistantTranscriptHtml() {
    if(!state.chat.length)return '<div class="assistant-empty">Your conversation with Jarvis will appear here. Choose a practice action or ask a question.</div>';
    return state.chat.slice(-24).map(message=>`<div class="chat-message ${message.role==='user'?'mine':''}"><small>${message.role==='user'?'You':'CAMPUSLINK · Jarvis'}</small>${esc(message.text)}</div>`).join('');
  }
  function assistantMessagesForApi(currentText) {
    const completedTurns=[];
    let pendingUser=null;
    for(const item of state.chat.slice(0,-1)){
      if(item.role==='user')pendingUser={role:'user',content:item.text};
      else if(item.role==='assistant'&&pendingUser){completedTurns.push(pendingUser,{role:'assistant',content:item.text});pendingUser=null;}
    }
    return [...completedTurns.slice(-10),{role:'user',content:currentText}].slice(-12);
  }
  function renderAssistantWidget() {
    let root=$('#assistant-widget');
    if(!root){root=document.createElement('div');root.id='assistant-widget';document.body.appendChild(root);}
    const signedIn=!!state.token&&!!state.user;
    const personIcon='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="7.5" r="3.5"/><path d="M4.5 20c.4-4.1 3.1-6.4 7.5-6.4s7.1 2.3 7.5 6.4v.5h-15z"/></svg>';
    root.innerHTML=`<button class="assistant-launcher" type="button" data-assistant-toggle aria-expanded="${state.assistantOpen}" aria-label="${state.assistantOpen?'Close':'Open'} Jarvis assistant"><span class="assistant-launcher-icon">${personIcon}</span><span class="assistant-launcher-copy"><b>Jarvis</b><small>${signedIn?'CAMPUSLINK AI assistant':'Sign in to chat'}</small></span><span class="assistant-launcher-chevron">${state.assistantOpen?'−':'↑'}</span></button><section class="assistant-panel ${state.assistantOpen?'is-open':''}" aria-label="Jarvis, CAMPUSLINK AI assistant" ${state.assistantOpen?'':'hidden'}><header class="assistant-panel-head"><div class="assistant-avatar">${personIcon}</div><div><b>Jarvis</b><small>${signedIn?`${esc(state.user.name)} · CAMPUSLINK`: 'Branch-aware placement guidance'}</small></div><button type="button" class="assistant-icon-button" data-assistant-action="clear" title="Clear conversation" ${state.chat.length?'':'disabled'}>⌫</button><button type="button" class="assistant-icon-button" data-assistant-toggle aria-label="Close Jarvis">×</button></header>${signedIn?`<div class="assistant-panel-content"><div class="assistant-mode-row"><label for="assistant-mode">Practice mode</label><select id="assistant-mode">${assistantModeOptions()}</select></div><div class="assistant-quick-actions">${assistantActions.map(([mode,label,prompt])=>`<button type="button" data-assistant-action="quick" data-mode="${mode}" data-prompt="${esc(prompt)}">${esc(label)} <span>↗</span></button>`).join('')}</div><div class="assistant-transcript" id="assistant-messages">${assistantTranscriptHtml()}</div>${state.assistantBusy?'<div class="assistant-typing"><i></i><i></i><i></i><span>Jarvis is thinking…</span></div>':''}${state.assistantError?`<div class="assistant-error">${esc(state.assistantError)}</div>`:''}<form class="assistant-compose" data-form="assistant-chat"><input name="message" maxlength="2000" required placeholder="Ask Jarvis about placement prep…" ${state.assistantBusy?'disabled':''}><button type="submit" aria-label="Send message" ${state.assistantBusy?'disabled':''}>${state.assistantBusy?'…':'➤'}</button></form><small class="assistant-privacy">Your question and recent turns are sent to the configured AI service with the branch, year, career goal and listed skills. Do not send passwords or confidential personal data.</small></div>`:`<div class="assistant-panel-content assistant-signin"><span class="eyebrow">Jarvis, on every page</span><h3>Practice for your next opportunity.</h3><p>Sign in to get branch-aware guidance, interview practice, aptitude support and resume advice.</p><button class="btn btn-primary" type="button" data-action="login">Sign in to CAMPUSLINK →</button></div>`}</section>`;
  }

  async function notificationsPage() {
    const {items}=await api('/notifications');
    const type=(new URLSearchParams(state.routeQuery||'').get('type')||'').toLowerCase();
    const matchesType=n=>{
      const content=`${n.title||''} ${n.message||''}`.toLowerCase();
      if(type==='placement')return /vacan|job|placement|application|shortlist|interview|offer/.test(content);
      if(type==='quiz')return /quiz|test|score|practice/.test(content);
      if(type==='system')return !/vacan|job|placement|application|shortlist|interview|offer|quiz|test|score|practice/.test(content);
      return true;
    };
    const visibleItems=items.filter(matchesType);
    const titles={placement:'Placement Notifications',quiz:'Quiz Notifications',system:'System Notifications'};
    return `${heading(titles[type]||'Notifications','Vacancy alerts and updates from your placement activity.')}${type?'<a class="btn btn-ghost btn-sm" href="#notifications">View all notifications →</a>':''}<div class="grid">${visibleItems.length?visibleItems.map(n=>`<article class="card" style="display:flex;align-items:flex-start;gap:13px"><div class="metric-icon ${n.read?'':'teal'}">${n.read?'•':'!'}</div><div style="flex:1"><div class="card-head" style="margin-bottom:4px"><h3>${esc(n.title)}</h3>${badge(n.read?'Read':'Unread')}</div><p style="font-size:.84rem">${esc(n.message)}</p><small class="muted">${new Date(n.created_at).toLocaleString()}</small></div>${!n.read?`<button class="btn btn-secondary btn-sm" data-action="read-notification" data-id="${n.id}">Mark read</button>`:''}${n.link?`<a class="btn btn-ghost btn-sm" href="${esc(n.link)}">Open →</a>`:''}</article>`).join(''):empty(type?'No notifications in this category':'You’re all caught up',type?'Notifications matching this category will appear here.':'New vacancy alerts and application updates will appear here.','♧')}</div>`;
  }

  async function calendarPage() {
    const {items}=await api('/calendar');state.calendarEvents=items;const editing=state.editingEvent;
    const localDateTime=value=>{if(!value)return '';const d=new Date(value),pad=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;};
    return `${heading('Calendar & reminders','Plan interviews, tests, training and application deadlines.')}<div class="grid grid-main"><form class="card" data-form="calendar"><div class="card-head"><h3>${editing?'Edit event':'Add an event'}</h3>${editing?'<button class="btn btn-ghost btn-sm" type="button" data-action="cancel-event-edit">Cancel</button>':''}</div><div class="field"><label>Event title</label><input name="title" required placeholder="e.g. Acme technical interview" value="${esc(editing?.title||'')}"></div><div class="form-grid"><div class="field"><label>Event type</label><select name="type">${['Company Test','Interview','Application Deadline','Training','Quiz','Mock Interview','Reminder'].map(x=>`<option ${x===(editing?.type||'Training')?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Date and time</label><input type="datetime-local" name="starts_at" required value="${localDateTime(editing?.starts_at)}"></div></div><div class="field"><label>Notes</label><textarea name="notes" placeholder="Location, meeting link or preparation notes">${esc(editing?.notes||'')}</textarea></div><button class="btn btn-primary">${editing?'Update event':'Save event'}</button></form><article class="card"><div class="card-head"><h3>Your schedule</h3></div>${items.length?items.map(e=>`<div style="display:flex;gap:12px;padding:13px 0;border-bottom:1px solid var(--line)"><div class="metric-icon teal">□</div><div style="flex:1"><b>${esc(e.title)}</b><div class="muted" style="font-size:.77rem">${esc(e.type)} · ${new Date(e.starts_at).toLocaleString()}</div>${e.notes?`<div class="muted" style="font-size:.75rem;margin-top:4px">${esc(e.notes)}</div>`:''}</div><button class="btn btn-secondary btn-sm" data-action="edit-event" data-id="${e.id}">Edit</button><button class="btn btn-danger btn-sm" data-action="delete-event" data-id="${e.id}">Delete</button></div>`).join(''):empty('Nothing scheduled','Add an upcoming interview, test or reminder.','□')}</article></div>`;
  }

  async function certificatesPage() {
    const {items}=await api('/certificates');const admin=state.user.role==='ADMIN';
    const addForm=!admin?`<form class="card" id="certificate-form" data-form="certificate" hidden style="margin-bottom:16px"><div class="form-grid"><div class="field"><label>Certificate / course name</label><input name="name" required></div><div class="field"><label>Type</label><select name="type">${['NPTEL','Internship','Course','Workshop','Other'].map(x=>`<option>${x}</option>`).join('')}</select></div><div class="field"><label>Certificate ID</label><input name="certificate_id"></div><div class="field"><label>Issuer</label><input name="issuer"></div><div class="field"><label>Score (NPTEL)</label><input name="score" type="number" min="0" max="100" step=".1" placeholder="Optional"></div><div class="field"><label>Completion date</label><input name="completion_date" type="date"></div><div class="field"><label>Certificate link</label><input name="url" type="url" placeholder="https://"></div><div class="field full"><label>Upload evidence (optional PDF or image)</label><input name="file" type="file" accept=".pdf,.png,.jpg,.jpeg"></div></div><button class="btn btn-primary">Submit for review</button></form>`:'';
    return `${heading(admin?'Certificate verification':'My certificates',admin?'Review student certificate submissions. Unverified evidence stays marked for manual review.':'Add course and certificate details; new submissions are marked Requires Review.',admin?'':'<button class="btn btn-primary" data-action="show-certificate-form">+ Add certificate</button>')}${addForm}<article class="card"><div class="table-wrap"><table><thead><tr>${admin?'<th>Student</th>':''}<th>Certificate</th><th>Type</th><th>Certificate ID</th><th>NPTEL score</th><th>Completion</th><th>Status</th>${admin?'<th>Review</th>':''}</tr></thead><tbody>${items.map(c=>`<tr>${admin?`<td>${esc(c.student)}</td>`:''}<td><b>${esc(c.name)}</b><div class="muted">${esc(c.issuer||'')}</div></td><td>${esc(c.type)}</td><td>${esc(c.certificate_id||'—')}</td><td>${c.score===null||c.score===undefined?'—':`${c.score}%`}</td><td>${dateText(c.completion_date)}</td><td>${badge(c.status)}</td>${admin?`<td><select data-certificate-status="${c.id}" aria-label="Set verification status">${['REQUIRES_REVIEW','VERIFIED','UNVERIFIED','SUSPICIOUS'].map(s=>`<option ${s===c.status?'selected':''}>${s}</option>`).join('')}</select><button class="btn btn-secondary btn-sm" data-action="verify-certificate" data-id="${c.id}">Save</button></td>`:''}</tr>`).join('')}</tbody></table>${items.length?'':empty('No certificates yet','Certificate submissions will appear here with a clear review status.','◇')}</div></article><p class="muted" style="font-size:.75rem;margin-top:11px">CAMPUSLINK does not claim certificate authenticity without an authoritative verification source.</p>`;
  }

  async function projectsPage() {
    const {items}=await api('/student/projects');
    const editRequested=new URLSearchParams(state.routeQuery||'').get('edit')==='available';
    return `${heading('Projects','Record project work and share evidence with placement officers.', '<button class="btn btn-primary" data-action="show-project-form">+ Add project</button>')}${editRequested?'<article class="card profile-placeholder" id="projects-edit-project"><h3>Edit project</h3><p class="muted">This CAMPUSLINK version supports adding and viewing project records. Project editing is not available in the current API yet.</p></article>':''}<form class="card" data-form="project" id="project-form" hidden style="margin-bottom:16px"><div class="form-grid"><div class="field"><label>Project title</label><input name="title" required></div><div class="field"><label>Technologies</label><input name="technologies" placeholder="Python, Flask, MySQL"></div><div class="field"><label>GitHub URL</label><input name="github_url" type="url"></div><div class="field"><label>Demo URL</label><input name="demo_url" type="url"></div><div class="field full"><label>Description and outcomes</label><textarea name="description"></textarea></div></div><button class="btn btn-primary">Save project</button></form><div class="grid grid-2">${items.length?items.map(p=>`<article class="card"><div class="card-head"><h3>${esc(p.title)}</h3>${badge(p.status)}</div><p class="muted" style="font-size:.83rem">${esc(p.description)}</p><div class="chip-list">${p.technologies.map(x=>`<span class="chip">${esc(x)}</span>`).join('')}</div><div class="form-actions">${p.github_url?`<a class="btn btn-secondary btn-sm" href="${esc(p.github_url)}" target="_blank" rel="noreferrer">GitHub ↗</a>`:''}${p.demo_url?`<a class="btn btn-secondary btn-sm" href="${esc(p.demo_url)}" target="_blank" rel="noreferrer">Demo ↗</a>`:''}</div></article>`).join(''):empty('No projects added','Add a project to strengthen your match evidence.','⌘')}</div>`;
  }

  async function internshipsPage() {
    const {items}=await api('/student/internships');
    return `${heading('Internships','Add work experience and submit supporting evidence for review.','<button class="btn btn-primary" data-action="show-internship-form">+ Add internship</button>')}<form class="card" data-form="internship" id="internship-form" hidden style="margin-bottom:16px"><div class="form-grid"><div class="field"><label>Company</label><input name="company" required></div><div class="field"><label>Role</label><input name="role" placeholder="Software Intern"></div><div class="field"><label>Duration</label><input name="duration" placeholder="8 weeks"></div><div class="field"><label>Certificate URL</label><input name="certificate_url" type="url"></div><div class="field full"><label>Description</label><textarea name="description"></textarea></div></div><button class="btn btn-primary">Save internship</button></form><div class="grid grid-2">${items.length?items.map(i=>`<article class="card"><div class="card-head"><div><h3>${esc(i.role)}</h3><p class="muted" style="font-size:.8rem;margin:4px 0">${esc(i.company)} · ${esc(i.duration)}</p></div>${badge(i.status)}</div><p class="muted" style="font-size:.83rem">${esc(i.description)}</p>${i.certificate_url?`<a href="${esc(i.certificate_url)}" target="_blank" rel="noreferrer" class="btn btn-secondary btn-sm">Evidence ↗</a>`:''}</article>`).join(''):empty('No internships added','Add an internship record to show experience.')}</div>`;
  }

  function feedbackPage() {
    if (state.user.role === 'ADMIN') return adminFeedbackPage();
    return `${heading('Feedback','Help the placement team improve the CAMPUSLINK experience.')}<form class="card" data-form="feedback" style="max-width:780px"><div class="field"><label>Rating</label><select name="rating">${[5,4,3,2,1].map(x=>`<option value="${x}">${'★'.repeat(x)} · ${x}/5</option>`).join('')}</select></div><div class="field"><label>Category</label><select name="category">${['Website','Resume Analysis','AI Matching','Chatbot','Interview','Jobs','Analytics','Other'].map(x=>`<option>${x}</option>`).join('')}</select></div><div class="field"><label>Your feedback</label><textarea name="message" required minlength="4" placeholder="What worked well, or what could be clearer?"></textarea></div><button class="btn btn-primary">Send feedback</button></form>`;
  }
  async function adminFeedbackPage() {
    const {items}=await api('/admin/feedback');
    return `${heading('Website feedback','Review comments shared by students and recruiters.')}<article class="card"><div class="table-wrap"><table><thead><tr><th>Category</th><th>Rating</th><th>Message</th><th>Received</th></tr></thead><tbody>${items.map(f=>`<tr><td>${esc(f.category)}</td><td>${'★'.repeat(f.rating)}</td><td>${esc(f.message)}</td><td>${dateText(f.created_at)}</td></tr>`).join('')}</tbody></table>${items.length?'':empty('No feedback yet','Submitted feedback will appear here.')}</div></article>`;
  }

  async function createJobPage(editId = null) {
    let job=null;
    if(editId) { job=(await api('/company/jobs')).items.find(x=>x.id===editId); if(!job)throw new Error('Vacancy not found'); }
    state.editingJob=job;
    const {items:branchItems}=await api('/branches');
    const branches=branchItems.map(branch=>String(branch.name||'').trim()).filter(Boolean);
    const branchOptions=branches.map(branch=>`<option value="${esc(branch)}">${esc(branch)}</option>`).join('');
    const branchHelp=branches.length?'Type one or more branch names separated by commas, for example CSE AI, ECE. Suggestions come from the current branch list. Leave blank to include all branches.':'Type one or more branch names separated by commas. Leave blank to include all branches.';
    return `${heading(job?'Edit vacancy':'Post a vacancy',job?'Update role details and requirements.':'Publish your role to relevant student profiles.', '<a class="btn btn-secondary" href="#jobs">← My vacancies</a>')}<form class="card" data-form="job"><div class="form-grid"><div class="field"><label>Job title</label><input name="title" value="${esc(job?.title||'')}" required placeholder="Software Engineer"></div><div class="field"><label>Required skills</label><input name="required_skills" value="${esc(job?.required_skills?.join(', ')||'')}" placeholder="Python, SQL, Git"><small>Separate required skills with commas.</small></div><div class="field full"><label>Job description</label><textarea name="description" required>${esc(job?.description||'')}</textarea></div><div class="field"><label>Minimum CGPA</label><input name="minimum_cgpa" type="number" min="0" max="10" step=".1" value="${esc(job?.minimum_cgpa??7)}"></div><div class="field"><label>Minimum attendance (%)</label><input name="minimum_attendance" type="number" min="0" max="100" value="${esc(job?.minimum_attendance??75)}"></div><div class="field"><label>Eligible branches</label><input name="eligible_branches" list="eligible-branch-options" maxlength="2000" value="${esc(job?.eligible_branches?.join(', ')||'')}" placeholder="e.g. CSE, CSE AI, ECE" aria-label="Eligible branches"><datalist id="eligible-branch-options">${branchOptions}</datalist><small>${esc(branchHelp)}</small></div><div class="field"><label>Required certifications</label><input name="certifications" value="${esc(job?.certifications?.join(', ')||'')}" placeholder="Optional"></div><div class="field"><label>Experience</label><input name="experience" value="${esc(job?.experience||'Fresher / 0–1 years')}"></div><div class="field"><label>Salary / package</label><input name="salary" value="${esc(job?.salary||'')}" placeholder="8–12 LPA"></div><div class="field"><label>Location</label><input name="location" value="${esc(job?.location||'')}" placeholder="Bengaluru / Remote"></div><div class="field"><label>Vacancies</label><input name="vacancies" type="number" min="1" value="${esc(job?.vacancies||1)}"></div><div class="field"><label>Application deadline</label><input name="deadline" type="date" value="${esc(job?.deadline||'')}"></div><div class="field full"><label>Terms & conditions</label><textarea name="terms">${esc(job?.terms||'Assessment and interview details will be shared with shortlisted candidates.')}</textarea></div></div><button class="btn btn-primary" type="submit">${job?'Save vacancy changes':'Publish vacancy'}</button></form>`;
  }

  async function companyJobsPage() {
    const {items:all}=await api('/company/jobs');const query=new URLSearchParams(state.routeQuery||'').get('q')||'';const items=all.filter(j=>!query||j.title.toLowerCase().includes(query.toLowerCase())||j.required_skills.some(s=>s.toLowerCase().includes(query.toLowerCase())));
    return `${heading('My vacancies','Create, update and close roles. Review applications from students who applied.', '<a class="btn btn-primary" href="#create-job">+ Post vacancy</a>')}<div class="grid">${items.length?items.map(j=>`<article class="card"><div class="card-head"><div><h3>${esc(j.title)}</h3><p class="muted" style="font-size:.8rem;margin:4px 0">${esc(j.location)} · ${money(j.salary)} · ${j.vacancies} opening${j.vacancies===1?'':'s'}</p></div>${badge(j.active?'Open':'Closed')}</div><div class="chip-list">${j.required_skills.map(s=>`<span class="chip">${esc(s)}</span>`).join('')}</div><div class="job-meta"><span>CGPA ${j.minimum_cgpa}+</span><span>Attendance ${j.minimum_attendance}%+</span><span>Deadline ${dateText(j.deadline)}</span></div><div class="form-actions"><button class="btn btn-primary btn-sm" data-action="open-candidates" data-id="${j.id}">View applicants →</button><button class="btn btn-secondary btn-sm" data-action="edit-job" data-id="${j.id}">Edit role</button>${j.active?`<button class="btn btn-danger btn-sm" data-action="close-job" data-id="${j.id}">Close vacancy</button>`:''}</div></article>`).join(''):empty('No vacancies published','Create a vacancy with clear eligibility and skill requirements.')}</div>`;
  }

  async function candidatesPage() {
    const {items}=await api('/company/jobs');
    if(!items.length)return `${heading('Applicants','Review student applications for your vacancies.') }<div class="card">${empty('Create a vacancy first','Applications will appear after you publish a role and students apply.')}<a class="btn btn-primary" href="#create-job">Post a vacancy</a></div>`;
    const requestedJobId=new URLSearchParams(state.routeQuery||'').get('job_id');
    return `${heading('Applicants','Review profiles shared by students who applied to your vacancies.')}<article class="card"><div class="filter-row"><select id="candidate-job">${items.map(j=>`<option value="${j.id}" ${String(j.id)===requestedJobId?'selected':''}>${esc(j.title)} · ${esc(j.location)}</option>`).join('')}</select><button class="btn btn-primary btn-sm" data-action="load-candidates">Load applicants</button></div><div id="candidate-results"><div class="loading">Choose a vacancy to load its applicants.</div></div></article>`;
  }

  async function loadCandidates(jobId) {
    const wrap=$('#candidate-results'); if(!wrap)return;wrap.innerHTML='<div class="loading">Loading applications…</div>';
    const {items}=await api(`/company/jobs/${jobId}/applications`);state.candidates={};
    items.forEach(x=>{if(x.student)state.candidates[x.student.id]=x;});
    const rows=items.map(a=>{const p=a.student,m=a.match;return `<tr><td><div class="person-cell"><span class="avatar">${esc(initials(p.name))}</span><span><b>${esc(p.name)}</b><small>${esc(p.student_number||p.email)}</small></span></div></td><td>${esc(p.branch)}</td><td>${Number(p.cgpa||0).toFixed(2)}</td><td>${p.attendance}%</td><td><div class="chip-list">${(p.skills||[]).slice(0,4).map(s=>`<span class="chip">${esc(s.name)}</span>`).join('')}</div></td><td><div class="score-circle" style="--score:${m.score}"><span>${m.score}%</span></div></td><td>${badge(m.eligible?'Eligible':'Eligibility gap')}</td><td><select data-app-status="${a.id}">${['Applied','Shortlisted','Assessment','Interview','Selected','Offer','Joined','Rejected'].map(s=>`<option ${s===a.status?'selected':''}>${s}</option>`).join('')}</select><button class="btn btn-secondary btn-sm" data-action="save-app-status" data-id="${a.id}">Save</button></td><td><button class="btn btn-ghost btn-sm" data-action="candidate-profile" data-id="${p.id}">View profile</button></td></tr>`;}).join('');
    wrap.innerHTML=items.length?`<div class="table-wrap"><table><thead><tr><th>Student</th><th>Branch</th><th>CGPA</th><th>Attendance</th><th>Skills</th><th>Match</th><th>Eligibility</th><th>Application status</th><th>Profile</th></tr></thead><tbody>${rows}</tbody></table></div><p class="muted" style="font-size:.75rem;margin-top:12px">Only students who applied to this vacancy are listed. Their submitted profile and contact details are available from the Profile button.</p>`:empty('No applications yet','Student profiles will appear here after they apply for this vacancy.');
  }

  async function analyticsPage(page) {
    if(state.user.role==='ADMIN') {
      const d=await api('/admin/dashboard'); dashboardChartData=d;
      if(page==='skill-demand')return `${heading('Company skill demand','Active vacancy requirements grouped by skill.')}<div class="filter-row"><input id="skill-company-filter" placeholder="Company"><select id="skill-branch-filter"><option value="">All branches</option>${['CSE','CSE-AI','ECE','EEE','Mechanical','Civil'].map(x=>`<option>${x}</option>`).join('')}</select><input id="skill-role-filter" placeholder="Job role"><input id="skill-date-from" type="date" aria-label="From date"><input id="skill-date-to" type="date" aria-label="To date"><button class="btn btn-secondary btn-sm" data-action="filter-skill-demand">Apply filters</button></div><article class="card"><div class="card-head"><h3>Ranked demand</h3></div><div class="chart-wrap"><canvas id="analytics-skill-chart"></canvas></div><div class="table-wrap" style="margin-top:16px"><table><thead><tr><th>Rank</th><th>Skill</th><th>Active vacancies</th></tr></thead><tbody id="skill-demand-rows">${d.skill_demand.map((x,i)=>`<tr><td>${i+1}</td><td><b>${esc(x.skill)}</b></td><td>${x.jobs}</td></tr>`).join('')}</tbody></table></div></article>`;
      return `${heading('Placement analytics','Branch outcomes and conversion across the placement funnel.')}<div class="grid grid-4">${metric('Placement rate',`${d.metrics.placement_rate}%`,'↗','green')}${metric('Placed students',d.metrics.placed,'✦')}${metric('Average package',d.metrics.average_package?`${d.metrics.average_package} LPA`:'—','₹','teal')}${metric('Highest package',d.metrics.highest_package?`${d.metrics.highest_package} LPA`:'—','↑','amber')}</div><div class="grid grid-2" style="margin-top:16px"><article class="card"><div class="card-head"><h3>Branch placement</h3></div><div class="chart-wrap"><canvas id="analytics-branch-chart"></canvas></div></article><article class="card"><div class="card-head"><h3>Application funnel</h3></div><div class="chart-wrap"><canvas id="analytics-funnel-chart"></canvas></div></article></div><div class="grid grid-2" style="margin-top:16px"><article class="card"><div class="card-head"><h3>Branch outcomes</h3></div><div class="table-wrap"><table><thead><tr><th>Branch</th><th>Total students</th><th>Eligible</th><th>Placed</th><th>Placement rate</th></tr></thead><tbody>${d.branches.map(x=>`<tr><td>${esc(x.branch)}</td><td>${x.students}</td><td>${x.eligible}</td><td>${x.placed}</td><td><b>${x.rate}%</b></td></tr>`).join('')}</tbody></table></div></article><article class="card"><div class="card-head"><h3>Company hiring activity</h3></div>${d.companies_hiring.map(x=>`<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--line);font-size:.82rem"><span>${esc(x.company)}</span><span>${x.jobs} roles · ${x.applications} applications</span></div>`).join('')}</article></div>`;
    }
    const [placements,skills,companies]=await Promise.all([api('/analytics/placements'),api('/analytics/skills'),api('/analytics/companies')]);
    let companyItems=companies.items;
    if(state.user.role==='COMPANY') {
      const {profile}=await api('/company/profile');
      const ownActivity=companyItems.find(item=>Number(item.company_id)===Number(profile.id));
      companyItems=ownActivity?[ownActivity]:[];
    }
    dashboardChartData={...placements,skillDemand:skills.items,companies:companyItems};
    return `${heading('Hiring analytics','Review applicant flow and skill demand for your company’s vacancies.')}<div class="grid grid-3">${metric('Applications',Object.values(placements.funnel).reduce((a,b)=>a+b,0),'↗')}${metric('Active skill signals',skills.items.length,'⌁','teal')}${metric('Your open vacancies',companyItems[0]?.jobs||0,'◉','green')}</div><div class="filter-row" style="margin-top:16px"><select id="skill-branch-filter"><option value="">All branches</option>${['CSE','CSE-AI','ECE','EEE','Mechanical','Civil'].map(x=>`<option>${x}</option>`).join('')}</select><input id="skill-role-filter" placeholder="Job role"><input id="skill-date-from" type="date" aria-label="From date"><input id="skill-date-to" type="date" aria-label="To date"><button class="btn btn-secondary btn-sm" data-action="filter-skill-demand">Filter skill demand</button></div><div class="grid grid-2"><article class="card"><div class="card-head"><h3>Application funnel</h3></div><div class="chart-wrap"><canvas id="analytics-funnel-chart"></canvas></div></article><article class="card"><div class="card-head"><h3>In-demand skills</h3></div><div class="chart-wrap"><canvas id="analytics-skill-chart"></canvas></div></article></div><article class="card" style="margin-top:16px"><div class="card-head"><h3>Your hiring activity</h3></div><div class="table-wrap"><table><thead><tr><th>Company</th><th>Open roles</th><th>Applications</th></tr></thead><tbody>${companyItems.map(x=>`<tr><td>${esc(x.company)}</td><td>${x.jobs}</td><td>${x.applications}</td></tr>`).join('')}</tbody></table>${companyItems.length?'':empty('No company activity yet','Your vacancies and applications will appear here.')}</div></article>`;
  }
  function initAnalyticsCharts() {
    const d=dashboardChartData;if(!d)return;
    if(state.user.role==='ADMIN') {
      if(state.page==='skill-demand')drawChart('analytics-skill-chart','bar',d.skill_demand.map(x=>x.skill),d.skill_demand.map(x=>x.jobs),'#8b5cf6');
      else {drawChart('analytics-branch-chart','bar',d.branches.map(x=>x.branch),d.branches.map(x=>x.rate));drawChart('analytics-funnel-chart','bar',Object.keys(d.funnel),Object.values(d.funnel),'#8b5cf6');drawChart('analytics-package-chart','doughnut',Object.keys(d.package_analysis||{}),Object.values(d.package_analysis||{}));drawChart('analytics-trend-chart','line',(d.placement_trend||[]).map(x=>x.month),(d.placement_trend||[]).map(x=>x.count),'#8b5cf6');}
    } else {drawChart('analytics-funnel-chart','bar',Object.keys(d.funnel),Object.values(d.funnel),'#8b5cf6');drawChart('analytics-skill-chart','bar',d.skillDemand.map(x=>x.skill),d.skillDemand.map(x=>x.jobs));}
  }

  async function adminStudentsPage() {
    const {items:all}=await api('/admin/students');const query=new URLSearchParams(state.routeQuery||'').get('q')||'';const items=all.filter(p=>!query||`${p.name} ${p.branch} ${p.skills.map(s=>s.name).join(' ')}`.toLowerCase().includes(query.toLowerCase()));
    return `${heading('Students','Browse student profiles and preparation data.')}<div class="filter-row"><input id="admin-student-filter" placeholder="Filter name, branch or skill"><button class="btn btn-secondary btn-sm" data-action="filter-admin-students">Filter</button></div><article class="card"><div class="table-wrap"><table><thead><tr><th>Student</th><th>Branch</th><th>Year</th><th>CGPA</th><th>Attendance</th><th>Skills</th></tr></thead><tbody>${items.map(p=>`<tr data-student-search="${esc((p.name+' '+p.branch+' '+p.skills.map(s=>s.name).join(' ')).toLowerCase())}"><td><div class="person-cell"><span class="avatar">${esc(initials(p.name))}</span><span><b>${esc(p.name)}</b><small>${esc(p.student_number)} · ${esc(p.email)}</small></span></div></td><td>${esc(p.branch)}</td><td>${p.year}</td><td>${Number(p.cgpa).toFixed(2)}</td><td>${p.attendance}%</td><td><div class="chip-list">${p.skills.slice(0,3).map(s=>`<span class="chip">${esc(s.name)}</span>`).join('')}</div></td></tr>`).join('')}</tbody></table></div></article>`;
  }
  async function adminCompaniesPage() {
    const {items}=await api('/admin/companies');
    return `${heading('Companies','Recruiter accounts and organization profiles.')}<article class="card"><div class="table-wrap"><table><thead><tr><th>Company</th><th>Industry</th><th>Location</th><th>Recruiter</th><th>Contact</th><th>Website</th></tr></thead><tbody>${items.map(c=>`<tr><td><b>${esc(c.company_name)}</b></td><td>${esc(c.industry)}</td><td>${esc(c.location)}</td><td>${esc(c.recruiter_name)}</td><td>${esc(c.email)}</td><td>${c.website?`<a href="${esc(c.website)}" target="_blank" rel="noreferrer">Visit ↗</a>`:'—'}</td></tr>`).join('')}</tbody></table>${items.length?'':empty('No company profiles','Registered recruiter accounts will appear here.')}</div></article>`;
  }
  async function adminJobsPage() {
    const {items}=await api('/admin/jobs');
    return `${heading('Vacancies','All vacancies published by company accounts.')}<article class="card"><div class="table-wrap"><table><thead><tr><th>Role</th><th>Company</th><th>Skills</th><th>Eligibility</th><th>Deadline</th><th>State</th></tr></thead><tbody>${items.map(j=>`<tr><td><b>${esc(j.title)}</b></td><td>${esc(j.company)}</td><td>${esc(j.required_skills.slice(0,4).join(', '))}</td><td>${j.minimum_cgpa} CGPA · ${j.minimum_attendance}%</td><td>${dateText(j.deadline)}</td><td>${badge(j.active?'Open':'Closed')}</td></tr>`).join('')}</tbody></table>${items.length?'':empty('No vacancies yet','Company vacancies will appear here after publication.')}</div></article>`;
  }
  async function adminApplicationsPage() {
    const {items}=await api('/admin/applications');
    return `${heading('Applications','Review the placement funnel across active and completed vacancies.')}<article class="card"><div class="table-wrap"><table><thead><tr><th>Student</th><th>Role</th><th>Company</th><th>Match</th><th>Applied</th><th>Status</th></tr></thead><tbody>${items.map(a=>`<tr><td><b>${esc(a.student?.name||'Student')}</b><div class="muted">${esc(a.student?.branch||'')}</div></td><td>${esc(a.job?.title||'—')}</td><td>${esc(a.job?.company||'—')}</td><td>${Math.round(a.match_score)}%</td><td>${dateText(a.created_at)}</td><td>${badge(a.status)}</td></tr>`).join('')}</tbody></table>${items.length?'':empty('No applications','Application records will appear here.')}</div></article>`;
  }
  async function placementsPage() {
    const [placements,students,jobs]=await Promise.all([api('/admin/placements'),api('/admin/students'),api('/admin/jobs')]);
    return `${heading('Placement records','Record confirmed outcomes and review the placed-student list.')}<form class="card" data-form="placement" style="margin-bottom:16px"><div class="card-head"><h3>Add a placement outcome</h3></div><div class="form-grid"><div class="field"><label>Student</label><select name="student_id" required>${students.items.map(s=>`<option value="${s.id}">${esc(s.name)} · ${esc(s.branch)} · CGPA ${s.cgpa}</option>`).join('')}</select></div><div class="field"><label>Vacancy / company</label><select name="job_id"><option value="">Select if linked to a CAMPUSLINK vacancy</option>${jobs.items.map(j=>`<option value="${j.id}">${esc(j.company)} · ${esc(j.title)}</option>`).join('')}</select></div><div class="field"><label>Package (LPA)</label><input name="package_lpa" type="number" min="0" step=".01" required></div><div class="field"><label>Placement date</label><input name="placement_date" type="date"></div></div><button class="btn btn-primary">Save placement record</button></form><article class="card"><div class="card-head"><h3>Recorded outcomes <span class="badge blue">${placements.items.length}</span></h3></div><div class="table-wrap"><table><thead><tr><th>Student</th><th>Branch</th><th>Company</th><th>Role</th><th>Package</th><th>Date</th></tr></thead><tbody>${placements.items.map(p=>`<tr><td>${esc(p.student)}</td><td>${esc(p.branch)}</td><td>${esc(p.company||'External')}</td><td>${esc(p.job||'—')}</td><td>${p.package_lpa} LPA</td><td>${dateText(p.placement_date)}</td></tr>`).join('')}</tbody></table>${placements.items.length?'':empty('No placement outcomes yet','Add confirmed records to populate the placement analytics.')}</div></article>`;
  }
  async function evidencePage() {
    const {items}=await api('/admin/evidence');
    return `${heading('Evidence review','Review projects, internships and certificates submitted by students.')}<article class="card"><div class="table-wrap"><table><thead><tr><th>Student</th><th>Evidence</th><th>Type</th><th>Status</th><th>Review action</th></tr></thead><tbody>${items.map(x=>`<tr><td>${esc(x.student||'')}</td><td><b>${esc(x.title||x.name||x.role)}</b><div class="muted">${esc(x.company||x.description||'')}</div></td><td>${esc(x.kind)}</td><td>${badge(x.status||'REQUIRES_REVIEW')}</td><td>${x.kind==='certificate'?`<select data-certificate-status="${x.id}">${['REQUIRES_REVIEW','VERIFIED','UNVERIFIED','SUSPICIOUS'].map(s=>`<option ${s===x.status?'selected':''}>${s}</option>`).join('')}</select><button class="btn btn-secondary btn-sm" data-action="verify-certificate" data-id="${x.id}">Save</button>`:`<select data-evidence-status="${x.kind}:${x.id}">${['Pending','Verified','Rejected'].map(s=>`<option ${s===(x.status||'Pending')?'selected':''}>${s}</option>`).join('')}</select><button class="btn btn-secondary btn-sm" data-action="verify-evidence" data-id="${x.id}" data-kind="${x.kind}">Save</button>`}</td></tr>`).join('')}</tbody></table>${items.length?'':empty('Nothing waiting for review','Student-submitted evidence will appear here.')}</div></article><p class="muted" style="font-size:.75rem;margin-top:10px">Certificate state changes are manual review actions; CAMPUSLINK does not independently verify authenticity.</p>`;
  }

  const formValues = form => Object.fromEntries(new FormData(form).entries());
  const splitValues = value => String(value || '').split(',').map(x=>x.trim()).filter(Boolean);
  function routeChange() {
    const publicMenu=$('#public-links');if(publicMenu?.classList.contains('open')){publicMenu.classList.remove('open');$('.public-menu-toggle')?.setAttribute('aria-expanded','false');$('.public-menu-toggle')?.setAttribute('aria-label','Open navigation');}
    $('#sidebar')?.classList.remove('open');$('.sidebar-overlay')?.classList.remove('is-visible');$('.switcher')?.setAttribute('aria-expanded','false');$('.switcher')?.setAttribute('aria-label','Open navigation');
    const raw=location.hash.replace(/^#/,'')||'home'; const [path,query='']=raw.split('?');state.routeQuery=query;
    noteRouteVisit(raw);
    if(!state.token) { if(path!=='forgot-password')state.passwordReset={stage:'email',email:'',resetToken:'',role:'',resendAt:0};if(path==='login'||path==='register'){const role=new URLSearchParams(query).get('role')||'';showAuth(path==='register',role);}else if(path==='forgot-password'){const requestedRole=(new URLSearchParams(query).get('role')||'').toUpperCase();const role=['STUDENT','COMPANY','ADMIN'].includes(requestedRole)?requestedRole:'';if(state.passwordReset.role!==role)state.passwordReset={stage:'email',email:'',resetToken:'',role,resendAt:0};showPasswordRecovery(state.passwordReset.stage,role);}else {showLanding();if(['features','ai-tools','how','placements','contact','public-feedback'].includes(path))setTimeout(()=>document.getElementById(path)?.scrollIntoView({behavior:'smooth'}),30);}return; }
    if(!state.user) { bootstrap();return; }
    renderShell(path==='home'?'dashboard':path);
  }
  async function signOut(callApi = true, destination = 'home') {
    if(callApi && state.token) { try { await api('/auth/logout',{method:'POST'}); } catch {} }
    clearInterval(state.quiz?.timer);localStorage.removeItem('campuslink_token');sessionStorage.removeItem('campuslink_quiz_attempt');state.token='';state.user=null;state.profile=null;state.chat=[];state.assistantError='';state.assistantOpen=false;state.assistantMode='placement';state.quiz=null;state.interview=null;state.editingJob=null;renderAssistantWidget();location.hash=destination;if(destination==='login')showAuth(false);else showLanding();
  }
  async function authSubmit(form) {
    const data=formValues(form);const isRegister=form.dataset.form==='register';
    const result=await api(isRegister?'/auth/register':'/auth/login',{method:'POST',body:data});
    state.token=result.token;localStorage.setItem('campuslink_token',state.token);state.user=result.user;
    const me=await api('/auth/me');state.user=me.user;state.profile=me.profile||null;
    toast(isRegister?'Your CAMPUSLINK workspace is ready.':'Welcome back.','success');renderAssistantWidget();location.hash='dashboard';renderShell('dashboard');
  }

  document.addEventListener('click', event => {
    const assistantToggle=event.target.closest('[data-assistant-toggle]');
    if(assistantToggle){state.assistantOpen=!state.assistantOpen;renderAssistantWidget();document.querySelectorAll('[data-assistant-toggle]').forEach(toggle=>toggle.setAttribute('aria-expanded',String(state.assistantOpen)));return;}
    const assistantAction=event.target.closest('[data-assistant-action]');
    if(assistantAction){
      if(assistantAction.dataset.assistantAction==='clear'){state.chat=[];state.assistantError='';renderAssistantWidget();renderChatMessages();return;}
      if(assistantAction.dataset.assistantAction==='quick'){
        state.assistantMode=assistantAction.dataset.mode||'placement';state.assistantOpen=true;state.assistantError='';
        document.querySelectorAll('[data-assistant-toggle]').forEach(toggle=>toggle.setAttribute('aria-expanded','true'));
        sendChat(assistantAction.dataset.prompt,state.assistantMode);return;
      }
    }
    const auth=event.target.closest('[data-action="login"],[data-action="register"]');
    if(auth){const role=auth.dataset.role||auth.closest('form[data-role]')?.dataset.role||'';location.hash=`${auth.dataset.action}${role?`?role=${encodeURIComponent(role)}`:''}`;return;}
    const nav=event.target.closest('[data-page]');if(nav){location.hash=nav.dataset.page;return;}
    const button=event.target.closest('[data-action]');if(!button)return;
    const {action,id}=button.dataset;
    if(action==='navigate-back'){navigateBack();return;}
    if(action==='profile-add-item'||action==='profile-remove-item'){
      const key=button.dataset.collection;
      if(!['courses','achievements','interest_tags'].includes(key))return;
      const list=document.querySelector(`[data-collection-list="${CSS.escape(key)}"]`);
      if(action==='profile-add-item'&&list){list.insertAdjacentHTML('beforeend',profileCollectionRow(key,''));list.lastElementChild?.querySelector('input')?.focus();}
      if(action==='profile-remove-item')button.closest('.profile-collection-row')?.remove();
      return;
    }
    safe(async()=>{
      if(action==='return-to-login'){const role=state.passwordReset.role;state.passwordReset={stage:'email',email:'',resetToken:'',role:'',resendAt:0};location.hash=`login${role?`?role=${encodeURIComponent(role)}`:''}`;showAuth(false,role);return;}
      if(action==='change-recovery-email'){state.passwordReset.resetToken='';state.passwordReset.resendAt=0;showPasswordRecovery('email');return;}
      if(action==='resend-recovery-otp'){
        await withButtonBusy(button,'Sending…',async()=>{
          await api('/auth/company-password-reset/request-otp',{method:'POST',body:{email:state.passwordReset.email}});
          state.passwordReset.resendAt=Date.now()+60000;
          showPasswordRecovery('otp','COMPANY');
          toast('If the company account can be verified, a new code has been sent.','success');
        });return;
      }
      if(action==='logout'){await signOut();return;}
      if(action==='add-account'){await signOut(true,'login');return;}
      if(action==='toggle-menu'){
        const sidebar=$('#sidebar');const isOpen=sidebar?.classList.toggle('open')||false;
        $('.sidebar-overlay')?.classList.toggle('is-visible',isOpen);
        button.setAttribute('aria-expanded',String(isOpen));button.setAttribute('aria-label',isOpen?'Close navigation':'Open navigation');return;
      }
      if(action==='toggle-sidebar'){
        const shell=$('.app-shell');const isCollapsed=shell?.classList.toggle('sidebar-collapsed')||false;
        localStorage.setItem('campuslink_sidebar_collapsed',String(isCollapsed));
        button.setAttribute('aria-expanded',String(!isCollapsed));button.setAttribute('aria-label',`${isCollapsed?'Expand':'Collapse'} sidebar`);
        button.querySelector('span').textContent=isCollapsed?'»':'«';return;
      }
      if(action==='close-menu'){$('#sidebar')?.classList.remove('open');$('.sidebar-overlay')?.classList.remove('is-visible');$('.switcher')?.setAttribute('aria-expanded','false');$('.switcher')?.setAttribute('aria-label','Open navigation');return;}
      if(action==='toggle-nav-group'){
        const key=button.dataset.navKey;state.navExpanded[key]=!($('#sidebar [data-nav-group="'+CSS.escape(key)+'"]')?.classList.contains('is-open'));
        const group=$(`#sidebar [data-nav-group="${CSS.escape(key)}"]`);const open=state.navExpanded[key];
        group?.classList.toggle('is-open',open);const children=group?.querySelector('.nav-children');if(children)children.inert=!open;button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',`${open?'Collapse':'Expand'} ${group?.querySelector('.nav-tree-link span:nth-child(2)')?.textContent||'section'}`);return;
      }
      if(action==='refresh-quick-quiz'){
        quickQuizHydrated=false;
        renderPage('quizzes');
        return;
      }
      if(action==='toggle-theme'){
        const next=(localStorage.getItem('campuslink_theme')||'dark')==='dark'?'light':'dark';
        localStorage.setItem('campuslink_theme',next);document.documentElement.dataset.theme=next;
        const themeButton=$('.topbar .theme-toggle');if(themeButton){themeButton.textContent=next==='dark'?'☼':'☾';themeButton.setAttribute('aria-label',`Switch to ${next==='dark'?'light':'dark'} appearance`);}
        if(state.page==='dashboard')initDashboardCharts();else if(['analytics','skill-demand'].includes(state.page))initAnalyticsCharts();
        toast(`${next==='dark'?'Dark':'Light'} mode enabled.`,'success');if(state.page==='account')renderPage('account');return;
      }
      if(action==='toggle-password'){
        const input=document.getElementById(button.dataset.target);
        if(input){const visible=input.type==='password';input.type=visible?'text':'password';button.textContent=visible?'Hide':'Show';button.setAttribute('aria-label',visible?'Hide password':'Show password');button.setAttribute('aria-pressed',String(visible));}
        return;
      }
      if(action==='toggle-public-menu'){
        const nav=$('#public-links');const isOpen=nav?.classList.toggle('open')||false;
        button.setAttribute('aria-expanded',String(isOpen));button.setAttribute('aria-label',isOpen?'Close navigation':'Open navigation');return;
      }
      if(action==='filter-jobs'){const params=new URLSearchParams();const q=$('#job-filter')?.value||'',branch=$('#branch-filter')?.value||'';if(q)params.set('q',q);if(branch)params.set('branch',branch);location.hash=`jobs${params.toString()?`?${params.toString()}`:''}`;return;}
      if(action==='apply-job'){button.disabled=true;const result=await api(`/jobs/${id}/apply`,{method:'POST',body:{}});toast(`Application submitted · ${result.match.score}% estimated match · profile shared with ${result.application.job.company}`,'success');renderPage('jobs/'+id);return;}
      if(action==='show-certificate-form'||action==='show-project-form'||action==='show-internship-form'){const idMap={'show-certificate-form':'certificate-form','show-project-form':'project-form','show-internship-form':'internship-form'};const form=$(`#${idMap[action]}`);if(form){form.hidden=!form.hidden;form.scrollIntoView({behavior:'smooth',block:'center'});}return;}
      if(action==='start-quiz'){const result=await api(`/quizzes/${id}/start`,{method:'POST',body:{}});state.quiz={...result.quiz,questions:result.questions,index:0,answers:{},feedback:{},active:true,result:null,custom:false,seconds:result.quiz.duration_minutes*60,ends_at:Date.now()+result.quiz.duration_minutes*60*1000};persistActiveQuiz();renderPage('quizzes');return;}
      if(action==='quiz-next'||action==='quiz-prev'){
        captureCurrentQuizAnswer();
        const question=state.quiz.questions[state.quiz.index];
        if(action==='quiz-next'&&!state.quiz.custom&&state.quiz.answers[question.id]!==undefined&&!state.quiz.feedback?.[question.id]){await checkCurrentQuizAnswer();return;}
        state.quiz.index+=action==='quiz-next'?1:-1;persistActiveQuiz();renderPage('quizzes');return;
      }
      if(action==='quiz-check'){await checkCurrentQuizAnswer();return;}
      if(action==='quiz-done'){clearInterval(state.quiz?.timer);sessionStorage.removeItem('campuslink_quiz_attempt');state.quiz=null;quickQuizHydrated=false;renderPage('quizzes');return;}
      if(action==='open-candidates'){location.hash=`candidates?job_id=${id}`;return;}
      if(action==='load-candidates'){await loadCandidates($('#candidate-job')?.value);return;}
      if(action==='edit-job'){state.editingJob=null;location.hash=`create-job/${id}`;return;}
      if(action==='close-job'){await api(`/company/jobs/${id}`,{method:'DELETE'});toast('Vacancy closed.','success');renderPage('jobs');return;}
      if(action==='save-app-status'){const status=$(`[data-app-status="${id}"]`)?.value;await api(`/applications/${id}/status`,{method:'PUT',body:{status}});toast('Application status updated.','success');await loadCandidates($('#candidate-job')?.value);return;}
      if(action==='shortlist-candidate'){await api(`/company/jobs/${button.dataset.job}/candidates/${button.dataset.student}/shortlist`,{method:'POST',body:{}});toast('Eligible candidate shortlisted.','success');await loadCandidates(button.dataset.job);return;}
      if(action==='candidate-profile'){showCandidateProfile(Number(id));return;}
      if(action==='verify-certificate'){const status=$(`[data-certificate-status="${id}"]`)?.value;await api(`/certificates/${id}/verify`,{method:'PUT',body:{status}});toast('Certificate review saved.','success');renderPage(state.page);return;}
      if(action==='verify-evidence'){const key=`${button.dataset.kind}:${id}`;const status=$(`[data-evidence-status="${key}"]`)?.value;await api(`/verification/${button.dataset.kind}/${id}`,{method:'PUT',body:{status}});toast('Evidence review saved.','success');renderPage('evidence');return;}
      if(action==='read-notification'){await api(`/notifications/${id}/read`,{method:'PUT',body:{}});toast('Notification marked as read.','success');renderPage('notifications');return;}
      if(action==='delete-event'){await api(`/calendar/${id}`,{method:'DELETE'});toast('Event deleted.','success');renderPage('calendar');return;}
      if(action==='edit-event'){state.editingEvent=state.calendarEvents?.find(x=>x.id===Number(id))||null;renderPage('calendar');return;}
      if(action==='cancel-event-edit'){state.editingEvent=null;renderPage('calendar');return;}
      if(action==='filter-resources'){const filter=$('#resource-filter')?.value.trim()||'';let visible=0;document.querySelectorAll('.resource-item').forEach(node=>{node.hidden=!resourceSkillMatches(node.dataset.search||node.dataset.skill,filter);if(!node.hidden)visible++;});const emptyState=$('#resource-empty');if(emptyState)emptyState.hidden=visible>0;return;}
      if(action==='filter-admin-students'){const filter=$('#admin-student-filter')?.value.toLowerCase().trim()||'';document.querySelectorAll('[data-student-search]').forEach(node=>node.hidden=!!filter&&!node.dataset.studentSearch.includes(filter));return;}
      if(action==='filter-skill-demand'){
        const params=new URLSearchParams();[['company','skill-company-filter'],['branch','skill-branch-filter'],['role','skill-role-filter'],['date_from','skill-date-from'],['date_to','skill-date-to']].forEach(([key,selector])=>{const value=$(`#${selector}`)?.value?.trim();if(value)params.set(key,value);});
        const {items}=await api(`/analytics/skills?${params.toString()}`);dashboardChartData.skillDemand=items;dashboardChartData.skill_demand=items;
        if(state.user.role==='ADMIN'&&state.page==='skill-demand'){
          const rows=$('#skill-demand-rows');if(rows)rows.innerHTML=items.map((x,i)=>`<tr><td>${i+1}</td><td><b>${esc(x.skill)}</b></td><td>${x.jobs}</td></tr>`).join('');
        }
        drawChart('analytics-skill-chart','bar',items.map(x=>x.skill),items.map(x=>x.jobs),'#8b5cf6');toast(`${items.length} skills match these filters.`,'success');return;
      }
      if(action==='select-skill-career'){
        const result=await api('/student/skill-recommendations',{method:'PUT',body:{career_id:button.dataset.careerId}});
        saveSkillRecommendationResponse(result);toast(`${result.career_goal} selected.`,'success');await renderPage('recommendations');return;
      }
      if(action==='remove-career-skill'){
        const skills=[...(state.skillRecommendations?.current_skills||[])];skills.splice(Number(button.dataset.skillIndex),1);
        await persistSkillRecommendationSkills(skills);toast('Skill removed from your profile.','success');await renderPage('recommendations');return;
      }
      if(action==='filter-skill-recommendations'){applySkillRecommendationFilters();return;}
      if(action==='save-progress'){const name=button.dataset.item;const input=[...document.querySelectorAll('[data-progress-item]')].find(x=>x.dataset.progressItem===name);await api('/student/progress',{method:'PUT',body:{item_type:'roadmap',item_name:name,progress:Number(input?.value||0)}});toast('Progress saved.','success');return;}
      if(action==='chat-suggestion'){await sendChat(button.dataset.message);return;}
      if(action==='retry-communication'){
        const practice=state.communicationCoach;
        if(practice.reportError){await finishCommunicationPractice();return;}
        if(practice.messages.length){await sendCommunicationPracticeRequest();return;}
        const mode=practice.mode;
        practice.active=true;practice.error='';practice.messages=[{role:'user',display:'Let’s begin.',content:`Start a ${communicationModeLabel(mode)} English communication practice session. Greet me briefly and ask exactly one suitable opening question.`}];
        await sendCommunicationPracticeRequest();return;
      }
      if(action==='retry-communication-report'){await finishCommunicationPractice();return;}
      if(action==='end-communication-practice'){await finishCommunicationPractice();return;}
      if(action==='new-communication-practice'){
        state.communicationCoach={mode:state.communicationCoach.report?.next_mode||state.communicationCoach.mode,difficulty:'beginner',active:false,busy:false,messages:[],turnCount:0,corrections:[],vocabulary:[],error:'',report:null,reportError:'',lastRequest:''};
        renderPage('communication');return;
      }
      if(action==='interview-done'){if(state.interview?.final){state.interview=null;renderPage('interview');return;}const id=state.interview?.id;if(id){const {result}=await api(`/interview/${id}/finish`,{method:'POST',body:{}});state.interview.final=result;toast(`Practice complete · overall ${result.overall_score}%`,'success');renderPage('interview');}return;}
    });
  });

  document.addEventListener('change', event => {
    if(event.target.matches('[data-skill-proficiency]')){
      safe(async()=>{
        const skills=[...(state.skillRecommendations?.current_skills||[])];
        const index=Number(event.target.dataset.skillProficiency);
        if(!skills[index])return;
        skills[index]={...skills[index],proficiency:Number(event.target.value)};
        await persistSkillRecommendationSkills(skills);toast(`${skills[index].name} proficiency saved.`,'success');await renderPage('recommendations');
      });return;
    }
    if(event.target.matches('[data-skill-rec-status]')){
      safe(async()=>{
        const result=await api('/student/skill-recommendations/progress',{method:'PUT',body:{career_id:event.target.dataset.careerId,skill:event.target.dataset.skill,status:event.target.value}});
        saveSkillRecommendationResponse(result);toast(`${event.target.dataset.skill} progress saved.`,'success');await renderPage('recommendations');
      });return;
    }
    if(['skill-rec-priority','skill-rec-status-filter','skill-rec-sort'].includes(event.target.id)){applySkillRecommendationFilters();return;}
    if (event.target.name === 'role') {
      const form = event.target.closest('form[data-form="register"]');
      if (form) syncOrganizationField(form,event.target.value);
    }
    const quizForm=event.target.closest('form[data-form="quick-quiz-start"]');
    if(quizForm&&state.quickQuizOptions&&['category','difficulty','topic'].includes(event.target.name)){
      syncQuickQuizCount(quizForm,state.quickQuizOptions);
      const customTopic=$('select[name="category"]',quizForm)?.value==='Custom Topic';
      const topicInput=$('input[name="topic"]',quizForm);
      const topicLabel=$('label[for="quick-quiz-topic"]',quizForm);
      if(topicInput)topicInput.required=customTopic;
      if(topicLabel)topicLabel.textContent=customTopic?'Custom topic (required)':'Focus topic (optional)';
    }
    if(event.target.matches('form[data-form="quiz-submit"] input[name="choice"]')){
      const question=state.quiz?.questions?.[state.quiz.index];
      const hadFeedback=Boolean(question&&state.quiz?.feedback?.[question.id]);
      captureCurrentQuizAnswer(event.target.form);
      if(hadFeedback&&!state.quiz?.feedback?.[question.id])renderPage('quizzes');
    }
    if(event.target.id==='assistant-mode'){
      state.assistantMode=event.target.value;renderAssistantWidget();
    }
    if(event.target.id==='chatbot-mode'){
      state.assistantMode=event.target.value;renderAssistantWidget();
    }
    if(event.target.id==='communication-mode'){
      const description=$('#communication-mode-description');
      if(description)description.textContent=communicationModes[event.target.value]?.description||communicationModes.daily.description;
    }
  });

  document.addEventListener('input', event => {
    if(event.target.matches('input[name="phone"]')){
      event.target.value=event.target.value.replace(/[^0-9]/g,'').slice(0,10);
    }
    const form=event.target.closest('form[data-form="quick-quiz-start"]');
    if(form&&event.target.name==='topic'&&state.quickQuizOptions)syncQuickQuizCount(form,state.quickQuizOptions);
    if(event.target.matches('[data-skill-proficiency]')){
      const level=$(`[data-skill-value="${CSS.escape(event.target.dataset.skillProficiency)}"]`);
      if(level)level.textContent=`${skillLevelName(event.target.value)} · ${Number(event.target.value)||0}%`;
    }
    if(event.target.id==='skill-rec-search')applySkillRecommendationFilters();
  });

  document.addEventListener('submit', event => {
    const form=event.target.closest('form[data-form]');if(!form)return;event.preventDefault();
    safe(async()=>{
      const kind=form.dataset.form;
      if(kind==='career-skill-add'){
        const values=formValues(form),name=String(values.name||'').trim();
        if(!name)throw new Error('Enter a skill name.');
        const skills=[...(state.skillRecommendations?.current_skills||[])];
        const key=name.toLowerCase();
        const index=skills.findIndex(skill=>skill.name.toLowerCase()===key);
        const next={name,proficiency:Number(values.proficiency||60)};
        if(index>=0)skills[index]=next;else skills.push(next);
        const result=await persistSkillRecommendationSkills(skills);toast(`${next.name} saved to your skills.`,'success');await renderPage('recommendations');return;
      }
      if(kind==='company-recovery-email'){
        const email=String(formValues(form).email||'').trim().toLowerCase();
        if(!email)throw new Error('Enter your registered company email address.');
        await withButtonBusy($('button[type="submit"]',form),'Sending OTP…',async()=>{
          await api('/auth/company-password-reset/request-otp',{method:'POST',body:{email}});
          state.passwordReset={stage:'otp',email,resetToken:'',role:'COMPANY',resendAt:Date.now()+60000};
          showPasswordRecovery('otp','COMPANY');
        });
        return;
      }
      if(kind==='company-recovery-otp'){
        const otp=String(formValues(form).otp||'').trim();
        await withButtonBusy($('button[type="submit"]',form),'Verifying…',async()=>{
          const result=await api('/auth/company-password-reset/verify-otp',{method:'POST',body:{email:state.passwordReset.email,otp}});
          state.passwordReset.resetToken=result.reset_token;
          showPasswordRecovery('password','COMPANY');
        });
        return;
      }
      if(kind==='recovery-email'){
        const email=String(formValues(form).email||'').trim().toLowerCase();
        if(!email)throw new Error('Enter your registered email address.');
        state.passwordReset={stage:'verify',email,resetToken:'',role:state.passwordReset.role,resendAt:0};
        showPasswordRecovery('verify');
        return;
      }
      if(kind==='verify-recovery-details'){
        const values=formValues(form);
        await withButtonBusy($('button[type="submit"]',form),'Verifying…',async()=>{
          const result=await api('/auth/verify-recovery-details',{method:'POST',body:{email:state.passwordReset.email,name_prefix:String(values.name_prefix||'').trim(),date_of_birth:values.date_of_birth}});
          state.passwordReset.resetToken=result.reset_token;
          showPasswordRecovery('password');
        });
        return;
      }
      if(kind==='reset-password'){
        const values=formValues(form);
        if(values.password!==values.confirm_password)throw new Error('The passwords do not match');
        await withButtonBusy($('button[type="submit"]',form),'Resetting password…',async()=>{
          await api('/auth/reset-password',{method:'POST',body:{reset_token:state.passwordReset.resetToken,password:values.password}});
          state.passwordReset={stage:'success',email:'',resetToken:'',role:state.passwordReset.role,resendAt:0};
          showPasswordRecovery('success');
        });
        return;
      }
      if(kind==='login'||kind==='register'){await authSubmit(form);return;}
      if(kind==='recovery-details'){
        await withButtonBusy($('button[type="submit"]',form),'Saving…',async()=>{
          await api('/auth/recovery-details',{method:'PUT',body:formValues(form)});
          state.user.date_of_birth_configured=true;
          toast('Account recovery details saved.','success');
          renderPage('profile');
        });
        return;
      }
      if(kind==='student-profile'){
        const data=formValues(form);data.branch_id=Number(data.branch);delete data.branch;data.skills=splitValues(data.skills);for(const key of ['courses','achievements','interest_tags'])data[key]=[...form.querySelectorAll(`[data-profile-collection="${CSS.escape(key)}"]`)].map(input=>input.value.trim()).filter(Boolean);data.cgpa=Number(data.cgpa);data.attendance=Number(data.attendance);data.year=Number(data.year);data.semester=Number(data.semester);data.graduation_year=data.graduation_year===''?null:Number(data.graduation_year);
        const result=await api('/student/profile',{method:'PUT',body:data});state.profile=result.profile;toast('Profile changes saved successfully.','success');renderPage('profile');return;
      }
      if(kind==='account-name'){
        const values=formValues(form);const name=String(values.name||'').trim();
        if(!name)throw new Error('Enter an account name.');
        await withButtonBusy($('button[type="submit"]',form),'Saving…',async()=>{
          const result=await api('/account/name',{method:'PUT',body:{name,current_password:values.current_password}});
          state.user={...state.user,...result.user};
          if(state.profile&&Object.prototype.hasOwnProperty.call(state.profile,'name'))state.profile={...state.profile,name:result.user.name};
          toast('Account name updated.','success');await renderPage('account');
        });
        return;
      }
      if(kind==='account-password'){
        const values=formValues(form);
        if(values.new_password!==values.confirm_password)throw new Error('The new passwords do not match.');
        await withButtonBusy($('button[type="submit"]',form),'Saving…',async()=>{
          await api('/account/password',{method:'PUT',body:values});
          toast('Password changed successfully.','success');await renderPage('account');
        });
        return;
      }
      if(kind==='company-profile'){const result=await api('/company/profile',{method:'PUT',body:formValues(form)});state.profile=result.profile;toast('Company profile saved.','success');renderPage('profile');return;}
      if(kind==='resume-analyze'){
        const resume=$('input[name="file"]',form)?.files?.[0];
        const description=$('input[name="job_description_file"]',form)?.files?.[0];
        if(resume){const ext=resume.name.split('.').pop().toLowerCase();if(!['pdf','docx','doc'].includes(ext))throw new Error('Choose a PDF, DOCX, or DOC resume.');if(resume.size>10*1024*1024)throw new Error('Resume is larger than 10 MB.');}
        if(description&&description.size>2*1024*1024)throw new Error('Job description file is larger than 2 MB.');
        await withButtonBusy($('button[type="submit"]',form),'Analyzing…',async()=>{
          const result=await api('/resume/analyze',{method:'POST',body:new FormData(form)});
          const percent=result.analysis.match_percentage;
          toast(percent==null?'Resume analysis complete.':`Resume analysis complete · ${percent}% role skill match`,'success');
          await renderPage('resume');
        });
        return;
      }
      if(kind==='job'){
        const d=formValues(form);d.required_skills=splitValues(d.required_skills);d.certifications=splitValues(d.certifications);d.eligible_branches=splitValues(d.eligible_branches);d.minimum_cgpa=Number(d.minimum_cgpa||0);d.minimum_attendance=Number(d.minimum_attendance||0);d.vacancies=Number(d.vacancies||1);
        const editing=state.editingJob;const path=editing?`/company/jobs/${editing.id}`:'/company/jobs';const response=await api(path,{method:editing?'PUT':'POST',body:d});state.editingJob=null;toast(editing?'Vacancy updated.':'Vacancy published.','success');location.hash='jobs';renderPage('jobs');return;
      }
      if(kind==='quick-quiz-start'){
        const data=formValues(form);
        const options=state.quickQuizOptions;
        if(options?.daily?.used)throw new Error('You have used today’s Quick Quiz. Your next quiz is available on '+dateText(options.daily.next_eligible_date)+'.');
        if(['GENERATING','IN_PROGRESS'].includes(options?.daily?.status))throw new Error('A Quick Quiz attempt is already being prepared or resumed. Refresh the page to continue.');
        if(data.category==='Custom Topic'&&!String(data.topic||'').trim())throw new Error('Enter a topic for your custom quiz.');
        const count=Number(data.count);
        const minimum=Number(options?.min_questions)||3;
        const maximum=Number(options?.max_questions)||15;
        const effectiveDifficulty=data.difficulty==='Adaptive'?(options?.recommended_difficulty||'Medium'):data.difficulty;
        const available=Number(options?.availability?.[data.category]?.[effectiveDifficulty]||0);
        const hasTopic=Boolean(String(data.topic||'').trim());
        if(!Number.isInteger(count)||count<minimum||count>maximum||(!hasTopic&&count>available))throw new Error(`Choose a question count from ${minimum} to ${Math.min(maximum,hasTopic?maximum:available)} for this selection.`);
        data.count=count;
        await withButtonBusy($('button[type="submit"]',form),'Preparing quiz…',async()=>{
          const result=await api('/quizzes/quick/start',{method:'POST',body:data});
          if(!Array.isArray(result.questions)||result.questions.length!==count)throw new Error(`The quiz returned ${result.questions?.length||0} questions instead of ${count}. Please try again.`);
          state.quiz={...result.quiz,questions:result.questions,index:0,answers:{},feedback:{},active:true,result:null,custom:true,progress_revision:Number(result.quiz.attempt_revision||0),seconds:result.quiz.duration_minutes*60,ends_at:Date.now()+result.quiz.duration_minutes*60*1000};
          quickQuizHydrated=true;
          persistActiveQuiz();
          renderPage('quizzes');
        });
        return;
      }
      if(kind==='quiz-submit'){
        captureCurrentQuizAnswer(form);await submitCurrentQuiz();return;
      }
      if(kind==='interview-start'){
        const d=formValues(form);const result=await api('/interview/start',{method:'POST',body:d});state.interview={id:result.interview.id,category:result.interview.category,questions:result.interview.questions,index:0,results:[]};renderPage('interview');return;
      }
      if(kind==='interview-answer'){
        const d=formValues(form),q=state.interview.questions[state.interview.index];const {result}=await api(`/interview/${state.interview.id}/answer`,{method:'POST',body:d});state.interview.results.push({...result,question:q.prompt});state.interview.index++;renderPage('interview');return;
      }
      if(kind==='communication-coach-start'){
        const mode=String(formValues(form).mode||'daily');
        if(!communicationModes[mode])throw new Error('Choose a supported practice mode.');
        state.communicationCoach={mode,difficulty:'beginner',active:true,busy:false,messages:[{role:'user',display:'Let’s begin.',content:`Start a ${communicationModeLabel(mode)} English communication practice session. Greet me briefly and ask exactly one suitable opening question.`}],turnCount:0,corrections:[],vocabulary:[],error:'',report:null,reportError:'',lastRequest:'turn'};
        await sendCommunicationPracticeRequest();return;
      }
      if(kind==='communication-coach-message'){
        const text=String(formValues(form).message||'').trim();
        if(!text)throw new Error('Write a response before sending.');
        const practice=state.communicationCoach;
        if(!practice.active||practice.busy) return;
        practice.messages.push({role:'user',text,content:text});practice.turnCount+=1;practice.lastRequest='turn';
        await sendCommunicationPracticeRequest();return;
      }
      if(kind==='chat'){const d=formValues(form);await sendChat(d.message);form.reset();return;}
      if(kind==='assistant-chat'){const d=formValues(form);form.reset();await sendChat(d.message,state.assistantMode);return;}
      if(kind==='calendar'){
        const d=formValues(form);const editing=state.editingEvent;await api(editing?`/calendar/${editing.id}`:'/calendar',{method:editing?'PUT':'POST',body:d});state.editingEvent=null;toast(editing?'Calendar event updated.':'Calendar event saved.','success');renderPage('calendar');return;
      }
      if(kind==='certificate'){
        const fd=new FormData(form);const file=fd.get('file');if(file&&file.size>0&&file.size>10*1024*1024)throw new Error('Evidence file is larger than 10 MB.');await api('/certificates/upload',{method:'POST',body:fd});toast('Certificate submitted for manual review.','success');renderPage('certificates');return;
      }
      if(kind==='project'){
        const d=formValues(form);d.technologies=splitValues(d.technologies);await api('/student/projects',{method:'POST',body:d});toast('Project saved.','success');renderPage('projects');return;
      }
      if(kind==='internship'){
        await api('/student/internships',{method:'POST',body:formValues(form)});toast('Internship saved.','success');renderPage('internships');return;
      }
      if(kind==='feedback'){await api('/feedback',{method:'POST',body:formValues(form)});toast('Thank you for your feedback.','success');form.reset();return;}
      if(kind==='placement'){
        const d=formValues(form);d.student_id=Number(d.student_id);d.job_id=d.job_id?Number(d.job_id):null;d.package_lpa=Number(d.package_lpa);await api('/placement/records',{method:'POST',body:d});toast('Placement record saved.','success');renderPage('placements');return;
      }
    });
  });

  async function sendChat(message, mode=state.assistantMode||'placement') {
    const text=String(message||'').trim();if(!text||state.assistantBusy)return;
    if(!state.token||!state.user){location.hash='login';return;}
    state.assistantMode=mode;state.assistantError='';state.assistantOpen=true;state.chat.push({role:'user',text});
    state.assistantBusy=true;renderAssistantWidget();renderChatMessages();
    try{
      const messages=assistantMessagesForApi(text);
      const result=await api('/chatbot',{method:'POST',body:{messages,mode}});
      state.chat.push({role:'assistant',text:result.answer});
    }catch(error){
      state.assistantError=error.message||'Jarvis could not respond. Try again.';
      toast(state.assistantError,'error');
    }finally{
      state.assistantBusy=false;renderAssistantWidget();renderChatMessages();
      const mainError=$('#chatbot-error');if(mainError){mainError.textContent=state.assistantError;mainError.hidden=!state.assistantError;}
    }
  }

  function showCandidateProfile(id) {
    const a=state.candidates?.[id],p=a?.student,m=a?.match;if(!p)return;
    const node=document.createElement('div');node.className='modal-backdrop';node.innerHTML=`<div class="modal-card"><button class="icon-btn modal-close" aria-label="Close">×</button><div class="person-cell"><span class="avatar">${esc(initials(p.name))}</span><span><h2 style="font-size:1.2rem;margin:0">${esc(p.name)}</h2><small>${esc(p.student_number)} · ${esc(p.branch)}</small></span></div><div class="grid grid-3" style="margin:18px 0"><div><small class="muted">CGPA</small><b style="display:block">${Number(p.cgpa).toFixed(2)}</b></div><div><small class="muted">Attendance</small><b style="display:block">${p.attendance}%</b></div><div><small class="muted">Estimated match</small><b style="display:block">${m.score}%</b></div></div><h3>Skills</h3><div class="chip-list">${p.skills.map(x=>`<span class="chip">${esc(x.name)}</span>`).join('')}</div><div class="match-explain" style="margin-top:16px"><b>Fit factors</b><ul>${m.reasons.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><b style="display:block;margin-top:12px">Suggested next steps</b><ul>${m.recommendations.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div><p class="muted" style="font-size:.77rem;margin-top:14px">${esc(p.email)} · ${esc(p.phone||"No phone provided")} · ${esc(p.career_goal)}</p></div>`;
    node.classList.add('modal-active');document.body.appendChild(node);node.addEventListener('click',e=>{if(e.target===node||e.target.closest('.modal-close'))node.remove();});
  }

  document.addEventListener('keydown', event => {
    if(event.key==='Escape')document.querySelector('.modal-backdrop')?.remove();
    if(event.key==='Enter'&&event.target.id==='global-search'){const q=event.target.value.trim(),suffix=q?`?q=${encodeURIComponent(q)}`:'';location.hash=state.user?.role==='ADMIN'?`students${suffix}`:`jobs${suffix}`;}
  });
  window.addEventListener('hashchange',routeChange);
  renderAssistantWidget();
  bootstrap();
})();
