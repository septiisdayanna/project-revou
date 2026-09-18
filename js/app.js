/* ============================================================
   FINANCE TRACKER — app.js
   Vanilla JS · localStorage · No frameworks
   ============================================================ */

'use strict';

/* ──────────────────────────────────────────────
   CONSTANTS & STORAGE KEYS
────────────────────────────────────────────── */
const STORAGE_TRANSACTIONS = 'ft_transactions';
const STORAGE_CATEGORIES   = 'ft_categories';

const DEFAULT_CATEGORIES = [
  'Food & Dining',
  'Transport',
  'Housing',
  'Entertainment',
  'Healthcare',
  'Shopping',
  'Savings',
  'Salary',
  'Other',
];

/* ──────────────────────────────────────────────
   STATE
────────────────────────────────────────────── */
let transactions = [];   // Array of transaction objects
let categories   = [];   // Array of category name strings
let pendingDeleteId = null; // ID queued for deletion via modal

// Monthly summary navigation: tracks which year-month is displayed
const today = new Date();
let summaryYear  = today.getFullYear();
let summaryMonth = today.getMonth(); // 0-indexed

/* ──────────────────────────────────────────────
   PERSISTENCE HELPERS
────────────────────────────────────────────── */
function loadData() {
  try {
    const rawTx  = localStorage.getItem(STORAGE_TRANSACTIONS);
    const rawCat = localStorage.getItem(STORAGE_CATEGORIES);
    transactions = rawTx  ? JSON.parse(rawTx)  : [];
    categories   = rawCat ? JSON.parse(rawCat) : [...DEFAULT_CATEGORIES];
  } catch {
    transactions = [];
    categories   = [...DEFAULT_CATEGORIES];
  }
}

function saveTransactions() {
  localStorage.setItem(STORAGE_TRANSACTIONS, JSON.stringify(transactions));
}

function saveCategories() {
  localStorage.setItem(STORAGE_CATEGORIES, JSON.stringify(categories));
}

/* ──────────────────────────────────────────────
   UTILITIES
────────────────────────────────────────────── */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr) {
  // dateStr is YYYY-MM-DD
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day:   'numeric',
    year:  'numeric',
  });
}

function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString('en-US', {
    month: 'long',
    year:  'numeric',
  });
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function categoryIcon(category) {
  const map = {
    'food & dining':  '🍽️',
    'transport':      '🚗',
    'housing':        '🏠',
    'entertainment':  '🎬',
    'healthcare':     '🏥',
    'shopping':       '🛍️',
    'savings':        '💰',
    'salary':         '💼',
    'other':          '📦',
  };
  return map[category.toLowerCase()] || '🏷️';
}

/* ──────────────────────────────────────────────
   DOM REFERENCES
────────────────────────────────────────────── */
const $ = id => document.getElementById(id);

const els = {
  // Balance cards
  totalBalance:  $('totalBalance'),
  totalIncome:   $('totalIncome'),
  totalExpense:  $('totalExpense'),

  // Form
  form:          $('transactionForm'),
  txDescription: $('txDescription'),
  txAmount:      $('txAmount'),
  txType:        $('txType'),
  txCategory:    $('txCategory'),
  txDate:        $('txDate'),

  // Category manager
  newCategoryName: $('newCategoryName'),
  addCategoryBtn:  $('addCategoryBtn'),
  categoryList:    $('categoryList'),

  // Filters & sort
  filterType:     $('filterType'),
  filterCategory: $('filterCategory'),
  filterMonth:    $('filterMonth'),
  sortBy:         $('sortBy'),
  clearFiltersBtn: $('clearFiltersBtn'),

  // Transaction list
  transactionList: $('transactionList'),
  txCount:         $('txCount'),
  emptyState:      $('emptyState'),

  // Monthly summary
  prevMonth:           $('prevMonth'),
  nextMonth:           $('nextMonth'),
  summaryMonthLabel:   $('summaryMonthLabel'),
  summaryIncome:       $('summaryIncome'),
  summaryExpense:      $('summaryExpense'),
  summaryNet:          $('summaryNet'),
  summaryBreakdown:    $('summaryBreakdown'),

  // Modal
  deleteModal:    $('deleteModal'),
  modalBackdrop:  $('modalBackdrop'),
  confirmDelete:  $('confirmDelete'),
  cancelDelete:   $('cancelDelete'),
};

/* ──────────────────────────────────────────────
   RENDER — BALANCE CARDS
────────────────────────────────────────────── */
function renderBalanceCards() {
  const income  = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;

  els.totalBalance.textContent = formatCurrency(balance);
  els.totalIncome.textContent  = formatCurrency(income);
  els.totalExpense.textContent = formatCurrency(expense);
}

/* ──────────────────────────────────────────────
   RENDER — CATEGORY SELECTS & TAG LIST
────────────────────────────────────────────── */
function renderCategoryOptions() {
  // Helper to rebuild a <select> with category options
  function buildOptions(select, includeAll = false) {
    const current = select.value;
    select.innerHTML = '';
    if (includeAll) {
      const all = document.createElement('option');
      all.value = 'all';
      all.textContent = 'All';
      select.appendChild(all);
    }
    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      select.appendChild(opt);
    });
    // Restore previous selection if still valid
    if ([...select.options].some(o => o.value === current)) {
      select.value = current;
    }
  }

  buildOptions(els.txCategory, false);
  buildOptions(els.filterCategory, true);
}

function renderCategoryTags() {
  els.categoryList.innerHTML = '';
  categories.forEach((cat, idx) => {
    const li = document.createElement('li');
    const isDefault = DEFAULT_CATEGORIES.includes(cat);
    if (isDefault) li.classList.add('tag--default');

    li.innerHTML = `
      <span>${cat}</span>
      ${!isDefault
        ? `<button class="tag-delete-btn" aria-label="Remove ${cat}" data-index="${idx}">✕</button>`
        : ''}
    `;
    els.categoryList.appendChild(li);
  });
}

/* ──────────────────────────────────────────────
   RENDER — TRANSACTION LIST
────────────────────────────────────────────── */
function getFilteredSortedTransactions() {
  const typeFilter     = els.filterType.value;
  const categoryFilter = els.filterCategory.value;
  const monthFilter    = els.filterMonth.value; // 'YYYY-MM' or ''
  const sortValue      = els.sortBy.value;

  let list = [...transactions];

  // Filter
  if (typeFilter !== 'all') {
    list = list.filter(t => t.type === typeFilter);
  }
  if (categoryFilter !== 'all') {
    list = list.filter(t => t.category === categoryFilter);
  }
  if (monthFilter) {
    list = list.filter(t => t.date.startsWith(monthFilter));
  }

  // Sort
  const [field, dir] = sortValue.split('-');
  list.sort((a, b) => {
    let comparison = 0;
    if (field === 'date') {
      comparison = a.date.localeCompare(b.date);
    } else if (field === 'amount') {
      comparison = a.amount - b.amount;
    } else if (field === 'category') {
      comparison = a.category.localeCompare(b.category);
    }
    return dir === 'desc' ? -comparison : comparison;
  });

  return list;
}

function renderTransactions() {
  const list = getFilteredSortedTransactions();

  els.txCount.textContent = `${list.length} item${list.length !== 1 ? 's' : ''}`;

  if (list.length === 0) {
    els.transactionList.innerHTML = '';
    const li = document.createElement('li');
    li.className = 'tx-empty';
    li.textContent = transactions.length === 0
      ? 'No transactions yet. Add one above!'
      : 'No transactions match your filters.';
    els.transactionList.appendChild(li);
    return;
  }

  els.transactionList.innerHTML = '';
  list.forEach(tx => {
    const li = document.createElement('li');
    li.className = `tx-item tx-item--${tx.type}`;
    li.dataset.id = tx.id;

    const sign   = tx.type === 'income' ? '+' : '−';
    const amtCls = `tx-amount tx-amount--${tx.type}`;

    li.innerHTML = `
      <span class="tx-icon" aria-hidden="true">${categoryIcon(tx.category)}</span>
      <div class="tx-info">
        <div class="tx-desc">${escapeHtml(tx.description)}</div>
        <div class="tx-meta">${escapeHtml(tx.category)} · ${formatDate(tx.date)}</div>
      </div>
      <span class="${amtCls}">${sign}${formatCurrency(tx.amount)}</span>
      <button class="tx-delete-btn" aria-label="Delete transaction" data-id="${tx.id}">🗑</button>
    `;
    els.transactionList.appendChild(li);
  });
}

/* ──────────────────────────────────────────────
   RENDER — MONTHLY SUMMARY
────────────────────────────────────────────── */
function renderMonthlySummary() {
  els.summaryMonthLabel.textContent = monthLabel(summaryYear, summaryMonth);

  const pad   = n => String(n).padStart(2, '0');
  const prefix = `${summaryYear}-${pad(summaryMonth + 1)}`;

  const monthTx = transactions.filter(t => t.date.startsWith(prefix));

  const income  = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const net     = income - expense;

  els.summaryIncome.textContent  = formatCurrency(income);
  els.summaryExpense.textContent = formatCurrency(expense);
  els.summaryNet.textContent     = formatCurrency(net);

  // Net color
  els.summaryNet.style.color = net >= 0
    ? 'var(--clr-income)'
    : 'var(--clr-expense)';

  // Spending breakdown by category (expenses only)
  const expenses = monthTx.filter(t => t.type === 'expense');
  const byCategory = {};
  expenses.forEach(t => {
    byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
  });

  const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const maxAmt = sorted.length ? sorted[0][1] : 0;

  els.summaryBreakdown.innerHTML = '';

  if (sorted.length === 0) {
    const li = document.createElement('li');
    li.className = 'breakdown-empty';
    li.textContent = 'No expenses this month.';
    els.summaryBreakdown.appendChild(li);
    return;
  }

  sorted.forEach(([cat, amt]) => {
    const pct = maxAmt > 0 ? (amt / maxAmt) * 100 : 0;
    const li  = document.createElement('li');
    li.className = 'breakdown-item';
    li.innerHTML = `
      <div class="breakdown-item__header">
        <span class="breakdown-item__name">${categoryIcon(cat)} ${escapeHtml(cat)}</span>
        <span class="breakdown-item__amount">${formatCurrency(amt)}</span>
      </div>
      <div class="breakdown-bar-track" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100">
        <div class="breakdown-bar-fill" style="width: ${pct}%"></div>
      </div>
    `;
    els.summaryBreakdown.appendChild(li);
  });
}

/* ──────────────────────────────────────────────
   FULL RE-RENDER
────────────────────────────────────────────── */
function renderAll() {
  renderBalanceCards();
  renderCategoryOptions();
  renderCategoryTags();
  renderTransactions();
  renderMonthlySummary();
}

/* ──────────────────────────────────────────────
   ACTIONS — TRANSACTIONS
────────────────────────────────────────────── */
function addTransaction(description, amount, type, category, date) {
  const tx = {
    id: generateId(),
    description: description.trim(),
    amount: parseFloat(amount),
    type,
    category,
    date,
  };
  transactions.unshift(tx); // newest first by default
  saveTransactions();
  renderAll();
}

function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  saveTransactions();
  renderAll();
}

/* ──────────────────────────────────────────────
   ACTIONS — CATEGORIES
────────────────────────────────────────────── */
function addCategory(name) {
  const trimmed = name.trim();
  if (!trimmed) return;
  if (categories.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
    showToast('Category already exists.', 'warn');
    return;
  }
  categories.push(trimmed);
  saveCategories();
  renderCategoryOptions();
  renderCategoryTags();
  showToast(`Category "${trimmed}" added.`);
}

function removeCategory(index) {
  const cat = categories[index];
  if (DEFAULT_CATEGORIES.includes(cat)) return; // protect defaults
  categories.splice(index, 1);
  saveCategories();
  renderCategoryOptions();
  renderCategoryTags();
}

/* ──────────────────────────────────────────────
   MODAL
────────────────────────────────────────────── */
function openDeleteModal(id) {
  pendingDeleteId = id;
  els.deleteModal.hidden   = false;
  els.modalBackdrop.hidden = false;
  els.confirmDelete.focus();
}

function closeDeleteModal() {
  pendingDeleteId = null;
  els.deleteModal.hidden   = true;
  els.modalBackdrop.hidden = true;
}

/* ──────────────────────────────────────────────
   TOAST NOTIFICATION (lightweight)
────────────────────────────────────────────── */
let toastTimer = null;

function showToast(message, type = 'info') {
  let toast = document.getElementById('ftToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'ftToast';
    Object.assign(toast.style, {
      position:     'fixed',
      bottom:       '1.5rem',
      right:        '1.5rem',
      background:   '#1e293b',
      color:        '#fff',
      padding:      '0.65rem 1.1rem',
      borderRadius: '8px',
      fontSize:     '0.875rem',
      fontFamily:   'inherit',
      boxShadow:    '0 4px 12px rgba(0,0,0,.2)',
      zIndex:       '200',
      transition:   'opacity 0.3s ease',
      opacity:      '0',
    });
    document.body.appendChild(toast);
  }
  if (type === 'warn') toast.style.background = '#b45309';
  else if (type === 'error') toast.style.background = '#dc2626';
  else toast.style.background = '#1e293b';

  toast.textContent = message;
  toast.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.style.opacity = '0'; }, 2500);
}

/* ──────────────────────────────────────────────
   SECURITY — ESCAPE HTML
────────────────────────────────────────────── */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ──────────────────────────────────────────────
   FORM VALIDATION
────────────────────────────────────────────── */
function validateForm(desc, amount, date) {
  if (!desc.trim()) {
    showToast('Please enter a description.', 'error');
    els.txDescription.focus();
    return false;
  }
  if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
    showToast('Please enter a valid amount greater than 0.', 'error');
    els.txAmount.focus();
    return false;
  }
  if (!date) {
    showToast('Please select a date.', 'error');
    els.txDate.focus();
    return false;
  }
  return true;
}

/* ──────────────────────────────────────────────
   EVENT LISTENERS
────────────────────────────────────────────── */

// --- Add Transaction Form ---
els.form.addEventListener('submit', e => {
  e.preventDefault();
  const desc   = els.txDescription.value;
  const amount = els.txAmount.value;
  const type   = els.txType.value;
  const cat    = els.txCategory.value;
  const date   = els.txDate.value;

  if (!validateForm(desc, amount, date)) return;

  addTransaction(desc, amount, type, cat, date);

  // Reset form but keep type/category/date selections for convenience
  els.txDescription.value = '';
  els.txAmount.value      = '';
  els.txDescription.focus();
  showToast('Transaction added.');
});

// --- Category Manager ---
els.addCategoryBtn.addEventListener('click', () => {
  addCategory(els.newCategoryName.value);
  els.newCategoryName.value = '';
  els.newCategoryName.focus();
});

els.newCategoryName.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addCategory(els.newCategoryName.value);
    els.newCategoryName.value = '';
  }
});

// Delete category tags (event delegation)
els.categoryList.addEventListener('click', e => {
  const btn = e.target.closest('.tag-delete-btn');
  if (!btn) return;
  const index = parseInt(btn.dataset.index, 10);
  removeCategory(index);
});

// --- Filters & Sort (event delegation on filter bar) ---
[els.filterType, els.filterCategory, els.filterMonth, els.sortBy].forEach(el => {
  el.addEventListener('change', renderTransactions);
});

els.clearFiltersBtn.addEventListener('click', () => {
  els.filterType.value     = 'all';
  els.filterCategory.value = 'all';
  els.filterMonth.value    = '';
  els.sortBy.value         = 'date-desc';
  renderTransactions();
});

// --- Transaction List delete (event delegation) ---
els.transactionList.addEventListener('click', e => {
  const btn = e.target.closest('.tx-delete-btn');
  if (!btn) return;
  openDeleteModal(btn.dataset.id);
});

// --- Delete Modal ---
els.confirmDelete.addEventListener('click', () => {
  if (pendingDeleteId) {
    deleteTransaction(pendingDeleteId);
    showToast('Transaction deleted.');
  }
  closeDeleteModal();
});

els.cancelDelete.addEventListener('click', closeDeleteModal);
els.modalBackdrop.addEventListener('click', closeDeleteModal);

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !els.deleteModal.hidden) closeDeleteModal();
});

// --- Monthly Summary Navigation ---
els.prevMonth.addEventListener('click', () => {
  summaryMonth--;
  if (summaryMonth < 0) { summaryMonth = 11; summaryYear--; }
  renderMonthlySummary();
});

els.nextMonth.addEventListener('click', () => {
  summaryMonth++;
  if (summaryMonth > 11) { summaryMonth = 0; summaryYear++; }
  renderMonthlySummary();
});

/* ──────────────────────────────────────────────
   INIT
────────────────────────────────────────────── */
function init() {
  loadData();
  // Set date input to today by default
  els.txDate.value = todayISO();
  renderAll();
}

init();
