const STORAGE_KEY = 'carnet-commercant-v1';
const AUTH_USERS_KEY = 'sutura-caisse-users-v1';
const AUTH_SESSION_KEY = 'sutura-caisse-session-v1';
const USER_DATA_PREFIX = 'sutura-caisse-user-data-v1:';
const SHOP_NAME = 'Boutique';
const SUPABASE_URL = 'https://pfapqfupqdhakteihjdb.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_PUBLISHABLE_KEY';
const isSupabaseConfigured = Boolean(
  SUPABASE_ANON_KEY &&
  typeof window !== 'undefined' &&
  window.supabase &&
  !SUPABASE_ANON_KEY.startsWith('YOUR_')
);
const supabaseClient = isSupabaseConfigured
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const defaultState = {
  sales: [],
  debts: []
};

let currentUser = getCurrentAuthUser();
let state = loadState();

const saleForm = document.getElementById('sale-form');
const debtForm = document.getElementById('debt-form');
const salesList = document.getElementById('sales-list');
const debtsList = document.getElementById('debts-list');
const salesTotal = document.getElementById('sales-total');
const summarySales = document.getElementById('summary-sales');
const summaryDebts = document.getElementById('summary-debts');
const summaryDebtCount = document.getElementById('summary-debt-count');
const summaryTodaySales = document.getElementById('summary-today-sales');
const debtDateInput = document.getElementById('dateDette');
const navItems = document.querySelectorAll('.nav-item');
const tabPanels = document.querySelectorAll('.tab-panel');
const offlineToggle = document.getElementById('offline-toggle');
const offlineInfo = document.getElementById('offline-info');
const proModal = document.getElementById('pro-modal');
const openProModalButton = document.getElementById('open-pro-modal');
const closeProModalButton = document.getElementById('close-pro-modal');
const proConfirmationForm = document.getElementById('pro-confirmation-form');
const proPaymentButtons = document.querySelectorAll('.payment-pro-btn');
const authForm = document.getElementById('auth-form');
const authToggleButton = document.getElementById('auth-toggle-mode');
const authTitle = document.getElementById('auth-title');
const authSubtitle = document.getElementById('auth-subtitle');
const authSubmitButton = document.getElementById('auth-submit-btn');
const authFeedback = document.getElementById('auth-feedback');
const logoutButton = document.getElementById('logout-btn');
const appScreen = document.getElementById('app-screen');
const authScreen = document.getElementById('auth-screen');
const currentUserEmail = document.getElementById('current-user-email');

initialize();

function initialize() {
  const dateField = document.getElementById('dateDette');
  if (dateField && !dateField.value) {
    dateField.value = new Date().toISOString().split('T')[0];
  }

  prefillFromQueryParams();
  bindNav();
  bindForms();
  bindPaymentSelectors();
  bindOfflineToggle();
  bindProModal();
  bindAuthFlow();
  initializeAuthView();
  showTab('cash-tab');
  renderAll();
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function makeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `user-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeSalt() {
  const length = 16;
  const values = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(values);
    return Array.from(values)
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('');
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function hashPassword(password, salt) {
  const value = String(password || '');
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(value),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const saltBytes = encoder.encode(salt);
  const digest = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: saltBytes,
      iterations: 120000
    },
    keyMaterial,
    256
  );

  const bytes = new Uint8Array(digest);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function readAuthUsers() {
  try {
    const stored = localStorage.getItem(AUTH_USERS_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function writeAuthUsers(users) {
  localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users));
}

function getCurrentAuthUser() {
  try {
    const stored = localStorage.getItem(AUTH_SESSION_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (!parsed || !parsed.id || !parsed.email) return null;
    return { id: parsed.id, email: normalizeEmail(parsed.email) };
  } catch (error) {
    return null;
  }
}

function getUserDataKey(userId) {
  return `${USER_DATA_PREFIX}${userId}`;
}

function setAuthSession(user) {
  currentUser = { id: user.id, email: normalizeEmail(user.email) };
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(currentUser));
}

function clearAuthSession() {
  currentUser = null;
  localStorage.removeItem(AUTH_SESSION_KEY);
}

function showAuthFeedback(message, isError = false) {
  if (!authFeedback) return;
  authFeedback.textContent = message;
  authFeedback.classList.toggle('error', isError);
  authFeedback.classList.toggle('success', !isError);
}

function initializeAuthView() {
  if (!authScreen || !appScreen) return;

  if (currentUser) {
    authScreen.classList.add('hidden');
    appScreen.classList.remove('hidden');
    if (currentUserEmail) {
      currentUserEmail.textContent = currentUser.email;
    }
  } else {
    authScreen.classList.remove('hidden');
    appScreen.classList.add('hidden');
    if (currentUserEmail) {
      currentUserEmail.textContent = '';
    }
  }
}

function bindAuthFlow() {
  if (!authForm || !authToggleButton || !authSubmitButton) return;

  authToggleButton.addEventListener('click', () => {
    const isLoginMode = authForm.dataset.mode === 'login';
    authForm.dataset.mode = isLoginMode ? 'register' : 'login';
    authTitle.textContent = isLoginMode ? 'Créer un compte' : 'Connexion';
    authSubtitle.textContent = isLoginMode
      ? 'Créez votre compte pour sauvegarder vos ventes et dettes.'
      : 'Récupérez vos données de caisse en vous reconnectant.';
    authSubmitButton.textContent = isLoginMode ? 'Créer mon compte' : 'Se connecter';
    authToggleButton.textContent = isLoginMode ? 'J’ai déjà un compte' : 'Créer un compte';
    showAuthFeedback('');
  });

  authForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(authForm);
    const email = normalizeEmail(formData.get('email'));
    const password = String(formData.get('password') || '');

    if (!email || !password || password.length < 6) {
      showAuthFeedback('Saisissez un email valide et un mot de passe de 6 caractères minimum.', true);
      return;
    }

    const isRegisterMode = authForm.dataset.mode !== 'login';
    const users = readAuthUsers();

    if (isRegisterMode) {
      const existingUser = users.find((user) => user.email === email);
      if (existingUser) {
        showAuthFeedback('Ce compte existe déjà. Connectez-vous plutôt.', true);
        return;
      }

      const salt = makeSalt();
      const passwordHash = await hashPassword(password, salt);
      const newUser = {
        id: makeId(),
        email,
        passwordHash,
        salt,
        createdAt: new Date().toISOString()
      };

      users.push(newUser);
      writeAuthUsers(users);
      setAuthSession(newUser);
      initializeAuthView();
      state = loadState();
      renderAll();
      authForm.reset();
      showAuthFeedback('Compte créé avec succès.');
      return;
    }

    const user = users.find((entry) => entry.email === email);
    if (!user) {
      showAuthFeedback('Aucun compte trouvé pour cet email.', true);
      return;
    }

    const passwordHash = await hashPassword(password, user.salt);
    if (passwordHash !== user.passwordHash) {
      showAuthFeedback('Mot de passe incorrect.', true);
      return;
    }

    setAuthSession(user);
    initializeAuthView();
    state = loadState();
    renderAll();
    authForm.reset();
    showAuthFeedback('Connexion réussie.');
  });

  if (logoutButton) {
    logoutButton.addEventListener('click', () => {
      clearAuthSession();
      initializeAuthView();
      state = loadState();
      renderAll();
      authForm.reset();
      showAuthFeedback('Vous êtes bien déconnecté.');
    });
  }

  if (!authForm.dataset.mode) {
    authForm.dataset.mode = 'login';
    authTitle.textContent = 'Connexion';
    authSubtitle.textContent = 'Récupérez vos données de caisse en vous reconnectant.';
    authSubmitButton.textContent = 'Se connecter';
    authToggleButton.textContent = 'Créer un compte';
  }
}

function clearQueryParams() {
  const url = new URL(window.location.href);
  url.search = '';
  window.history.replaceState({}, '', url);
}

function prefillFromQueryParams() {
  const params = new URLSearchParams(window.location.search);
  const product = params.get('product');
  const amount = params.get('amount');
  const payment = params.get('payment');
  const date = params.get('date');

  if (product) {
    const productInput = document.getElementById('sale-product');
    if (productInput) productInput.value = product;
  }

  if (amount) {
    const amountInput = document.getElementById('sale-amount');
    if (amountInput) amountInput.value = amount;
  }

  if (payment) {
    const normalizedPayment = payment.trim();
    const parent = document.querySelector('#sale-form .payment-selector');
    const hiddenInput = document.getElementById('sale-payment');

    if (parent && hiddenInput) {
      parent.querySelectorAll('.payment-option').forEach((button) => {
        const isActive = button.dataset.payment === normalizedPayment;
        button.classList.toggle('active', isActive);
      });
      hiddenInput.value = normalizedPayment;
    }
  }

  if (date) {
    const dateField = document.getElementById('dateDette');
    if (dateField) dateField.value = date;
  }
}

function showTab(target) {
  tabPanels.forEach((panel) => {
    const isActive = panel.id === target;
    panel.classList.toggle('active', isActive);
    panel.style.display = isActive ? 'grid' : 'none';
    panel.hidden = !isActive;
  });

  navItems.forEach((item) => {
    const isActive = item.dataset.target === target;
    item.classList.toggle('active', isActive);
    item.setAttribute('aria-selected', String(isActive));
  });
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('.nav-item');
  if (!button) return;

  const target = button.dataset.target;
  if (!target) return;

  event.preventDefault();
  showTab(target);
});

function bindNav() {
  navItems.forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      const target = button.dataset.target;
      if (!target) return;
      showTab(target);
    });
  });
}

function handleSaleSubmit(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  const formData = new FormData(saleForm);
  const product = String(formData.get('product') || '').trim();
  const amount = Number(formData.get('amount'));
  const payment = String(formData.get('payment') || 'Espèces');

  if (!product || Number.isNaN(amount) || amount <= 0) {
    return;
  }

  const newSale = {
    id: Date.now(),
    product,
    amount,
    payment,
    date: getTodayDate(),
    time: getCurrentTime()
  };

  state.sales.unshift(newSale);
  saveState();
  persistTransaction({
    type: 'sale',
    product,
    amount,
    payment,
    date: getTodayDate(),
    time: getCurrentTime(),
    created_at: new Date().toISOString(),
    user_id: currentUser ? currentUser.id : null
  });
  saleForm.reset();
  clearQueryParams();
  const saleHiddenInput = document.getElementById('sale-payment');
  if (saleHiddenInput) saleHiddenInput.value = 'Espèces';
  document.querySelectorAll('#sale-form .payment-option').forEach((button) => {
    button.classList.toggle('active', button.dataset.payment === 'Espèces');
  });
  renderAll();
}

function handleDebtSubmit(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  const formData = new FormData(debtForm);
  const name = String(formData.get('name') || '').trim();
  const phone = String(formData.get('phone') || '').trim();
  const amount = Number(formData.get('amount'));
  const payment = String(formData.get('payment') || 'Espèces');
  const dateInput = document.getElementById('dateDette');
  const date = dateInput ? dateInput.value : getTodayDate();

  if (!name || !phone || Number.isNaN(amount) || amount <= 0 || !date) {
    return;
  }

  const newDebt = {
    id: Date.now(),
    name,
    phone: phone.replace(/\s+/g, ''),
    amount,
    payment,
    date
  };

  state.debts.unshift(newDebt);
  saveState();
  persistTransaction({
    type: 'debt',
    customer_name: name,
    customer_phone: phone.replace(/\s+/g, ''),
    amount,
    payment,
    date,
    created_at: new Date().toISOString(),
    user_id: currentUser ? currentUser.id : null
  });
  debtForm.reset();
  if (debtDateInput) {
    debtDateInput.value = new Date().toISOString().split('T')[0];
  }
  const debtHiddenInput = document.getElementById('debt-payment');
  if (debtHiddenInput) debtHiddenInput.value = 'Espèces';
  document.querySelectorAll('#debt-form .payment-option').forEach((button) => {
    button.classList.toggle('active', button.dataset.payment === 'Espèces');
  });
  clearQueryParams();
  renderAll();
}

function bindForms() {
  if (saleForm) {
    saleForm.addEventListener('submit', handleSaleSubmit);
    const saleSubmitButton = document.getElementById('sale-submit-btn');
    if (saleSubmitButton) {
      saleSubmitButton.addEventListener('click', (event) => {
        event.preventDefault();
        handleSaleSubmit(event);
      });
    }
  }

  if (debtForm) {
    debtForm.addEventListener('submit', handleDebtSubmit);
    const debtSubmitButton = document.getElementById('debt-submit-btn');
    if (debtSubmitButton) {
      debtSubmitButton.addEventListener('click', (event) => {
        event.preventDefault();
        handleDebtSubmit(event);
      });
    }
  }
}

function bindPaymentSelectors() {
  document.querySelectorAll('.payment-option').forEach((button) => {
    button.addEventListener('click', () => {
      const selectedPayment = button.dataset.payment;
      const parent = button.closest('.payment-selector');
      const hiddenInput = parent.nextElementSibling;

      parent.querySelectorAll('.payment-option').forEach((item) => {
        item.classList.toggle('active', item === button);
      });

      if (hiddenInput && hiddenInput.tagName === 'INPUT') {
        hiddenInput.value = selectedPayment;
      }
    });
  });
}

function toggleOfflineInfo() {
  if (!offlineInfo) return;
  offlineInfo.classList.toggle('visible');
}

function openProModal() {
  if (!proModal) return;
  proModal.classList.remove('hidden');
  proModal.setAttribute('aria-hidden', 'false');
}

function closeProModal() {
  if (!proModal) return;
  proModal.classList.add('hidden');
  proModal.setAttribute('aria-hidden', 'true');
}

function handleProPayment(method) {
  const targetPhone = '782939829';
  const message = encodeURIComponent(`Bonjour, je souhaite activer Sén Caisse Pro. Je paie par ${method}.`);

  if (method === 'Wave') {
    const waveNumber = '78 293 98 29';
    const instructions = `Pour payer par Wave : transférez 5 000 FCFA vers ${waveNumber} ou consultez le portail Wave de test pour finaliser l’activation.`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(waveNumber).catch(() => {});
    }

    const waveTestUrl = 'https://www.wave.com/fr/';
    window.open(waveTestUrl, '_blank', 'noopener,noreferrer');
    alert(instructions);
  } else if (method === 'Orange Money') {
    const orangeNumber = '78 293 98 29';
    const instructions = `Pour payer par Orange Money : ouvrez votre application Orange Money et transférez 5 000 FCFA vers le ${orangeNumber}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText('782939829').catch(() => {});
    }
    alert(instructions);
  } else if (method === 'WhatsApp') {
    window.open(`https://wa.me/221${targetPhone}?text=${message}`, '_blank');
  } else {
    window.open(`https://wa.me/221${targetPhone}?text=${message}`, '_blank');
  }
}

function bindOfflineToggle() {
  if (!offlineToggle || !offlineInfo) return;

  offlineToggle.addEventListener('click', () => {
    toggleOfflineInfo();
  });
}

function bindProModal() {
  if (!proModal || !openProModalButton || !closeProModalButton) return;

  openProModalButton.addEventListener('click', () => {
    openProModal();
  });

  closeProModalButton.addEventListener('click', () => {
    closeProModal();
  });

  proModal.addEventListener('click', (event) => {
    if (event.target === proModal) {
      closeProModal();
    }
  });

  proPaymentButtons.forEach((button) => {
    button.addEventListener('click', () => {
      handleProPayment(button.dataset.paymentMethod);
    });
  });

  if (proConfirmationForm) {
    proConfirmationForm.addEventListener('submit', (event) => {
      event.preventDefault();

      const businessName = document.getElementById('pro-name')?.value?.trim();
      const businessPhone = document.getElementById('pro-phone')?.value?.trim();

      if (!businessName || !businessPhone) {
        return;
      }

      const confirmationMessage = encodeURIComponent(
        `Bonjour, je confirme le paiement Sén Caisse Pro. Nom: ${businessName}. Numéro: ${businessPhone}.`
      );

      window.open(`https://wa.me/221782939829?text=${confirmationMessage}`, '_blank');
      proModal.classList.add('hidden');
      proModal.setAttribute('aria-hidden', 'true');
      proConfirmationForm.reset();
    });
  }
}

function renderAll() {
  if (!salesList || !debtsList || !salesTotal || !summarySales || !summaryDebts || !summaryDebtCount || !summaryTodaySales) {
    return;
  }

  renderSales();
  renderDebts();
  renderSummary();
}

function renderSales() {
  const todaySales = state.sales.filter((sale) => sale.date === getTodayDate());
  const total = todaySales.reduce((sum, sale) => sum + Number(sale.amount || 0), 0);
  salesTotal.textContent = formatCurrency(total);

  if (!todaySales.length) {
    salesList.innerHTML = '<li class="empty-state">Aucune vente enregistrée aujourd\'hui.</li>';
    return;
  }

  const recentSales = [...todaySales].sort((a, b) => b.id - a.id);
  salesList.innerHTML = recentSales
    .map(
      (sale) => `
        <li class="record-item">
          <div class="record-main">
            <strong>${escapeHtml(sale.product)}</strong>
            <span class="record-meta">${escapeHtml(sale.payment || 'Espèces')} • ${escapeHtml(sale.time)}</span>
          </div>
          <div class="record-amount">
            <div>${formatCurrency(sale.amount)}</div>
          </div>
        </li>
      `
    )
    .join('');
}

function renderDebts() {
  if (!state.debts.length) {
    debtsList.innerHTML = '<li class="empty-state">Aucun client en dette pour le moment.</li>';
    return;
  }

  const sortedDebts = [...state.debts].sort((a, b) => new Date(b.date) - new Date(a.date));

  debtsList.innerHTML = sortedDebts
    .map(
      (debt) => `
        <li class="record-item" style="display:block;">
          <div style="display:flex; justify-content:space-between; gap:10px; align-items:start;">
            <div class="record-main">
              <strong>${escapeHtml(debt.name)}</strong>
              <span class="record-meta">${escapeHtml(debt.payment || 'Espèces')} • ${escapeHtml(debt.phone)} • ${formatDate(debt.date)}</span>
            </div>
            <div class="record-amount">${formatCurrency(debt.amount)}</div>
          </div>
          <div class="record-actions">
            <button class="inline-btn secondary-btn" type="button" data-action="mark-paid" data-id="${debt.id}">Marquer payé</button>
            <button class="inline-btn" type="button" data-action="whatsapp" data-id="${debt.id}">Rappeler par WhatsApp</button>
          </div>
        </li>
      `
    )
    .join('');

  debtsList.querySelectorAll('[data-action="whatsapp"]').forEach((button) => {
    button.addEventListener('click', () => {
      const debt = state.debts.find((item) => String(item.id) === String(button.dataset.id));
      if (!debt) return;
      openWhatsAppReminder(debt);
    });
  });

  debtsList.querySelectorAll('[data-action="mark-paid"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.debts = state.debts.filter((item) => String(item.id) !== String(button.dataset.id));
      saveState();
      renderAll();
    });
  });
}

function renderSummary() {
  const totalSales = state.sales.reduce((sum, sale) => sum + Number(sale.amount || 0), 0);
  const totalDebts = state.debts.reduce((sum, debt) => sum + Number(debt.amount || 0), 0);
  const todayTotal = state.sales
    .filter((sale) => sale.date === getTodayDate())
    .reduce((sum, sale) => sum + Number(sale.amount || 0), 0);

  summarySales.textContent = formatCurrency(totalSales);
  summaryDebts.textContent = formatCurrency(totalDebts);
  summaryDebtCount.textContent = String(state.debts.length);
  summaryTodaySales.textContent = formatCurrency(todayTotal);
}

function openWhatsAppReminder(debt) {
  const cleanedPhone = String(debt.phone || '').replace(/\D/g, '');
  let phoneForWhatsApp = cleanedPhone;

  if (cleanedPhone.startsWith('0')) {
    phoneForWhatsApp = `225${cleanedPhone.slice(1)}`;
  }

  const message = `Bonjour ${debt.name}, petit rappel concernant votre reste à payer de ${formatCurrency(debt.amount)} chez ${SHOP_NAME}. Merci !`;
  const whatsappUrl = `https://wa.me/${phoneForWhatsApp}?text=${encodeURIComponent(message)}`;

  window.open(whatsappUrl, '_blank');
}

function hasSampleData(entries) {
  if (!Array.isArray(entries)) return false;
  return entries.some((entry) => {
    const product = entry?.product || '';
    const name = entry?.name || '';
    return product === 'Riz 25kg' || product === 'Huile 5L' || name === 'Aminata D.';
  });
}

function loadState() {
  if (!currentUser) {
    return JSON.parse(JSON.stringify(defaultState));
  }

  const userStorageKey = getUserDataKey(currentUser.id);

  try {
    const stored = localStorage.getItem(userStorageKey);
    if (!stored) {
      const freshState = JSON.parse(JSON.stringify(defaultState));
      localStorage.setItem(userStorageKey, JSON.stringify(freshState));
      return freshState;
    }

    const parsed = JSON.parse(stored);
    const sales = Array.isArray(parsed.sales) ? parsed.sales : [];
    const debts = Array.isArray(parsed.debts) ? parsed.debts : [];

    const sanitizedSales = hasSampleData(sales) ? [] : sales;
    const sanitizedDebts = hasSampleData(debts) ? [] : debts;

    if (sanitizedSales.length !== sales.length || sanitizedDebts.length !== debts.length) {
      localStorage.setItem(userStorageKey, JSON.stringify({ sales: sanitizedSales, debts: sanitizedDebts }));
    }

    return {
      sales: sanitizedSales,
      debts: sanitizedDebts
    };
  } catch (error) {
    return JSON.parse(JSON.stringify(defaultState));
  }
}

function saveState() {
  if (!currentUser) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return;
  }

  localStorage.setItem(getUserDataKey(currentUser.id), JSON.stringify(state));
}

async function persistTransaction(transaction) {
  if (!supabaseClient) {
    console.warn('Supabase non initialisé. Vérifie la clé Publishable Key.');
    return;
  }

  try {
    const { error } = await supabaseClient.from('transactions').insert([transaction]);
    if (error) {
      console.error('Erreur d\'enregistrement Supabase:', error.message || error);
    }
  } catch (error) {
    console.error('Erreur d\'enregistrement Supabase:', error);
  }
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function getCurrentTime() {
  return new Date().toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

function formatCurrency(value) {
  const amount = Number(value || 0);
  return `${new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)} FCFA`;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

window.toggleOfflineInfo = toggleOfflineInfo;
window.openProModal = openProModal;
window.closeProModal = closeProModal;
window.handleProPayment = handleProPayment;
window.createAuthManager = () => ({
  getCurrentUser: getCurrentAuthUser,
  logout: () => {
    clearAuthSession();
    initializeAuthView();
    state = loadState();
    renderAll();
  }
});
window.getCurrentAuthUser = getCurrentAuthUser;
