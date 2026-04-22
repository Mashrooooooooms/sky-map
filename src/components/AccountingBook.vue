<template>
  <div v-if="visible" class="modal-overlay" @click.self="close">
    <div class="modal-container accounting-modal">
      <div class="modal-header">
        <span>📖 КНИГА УЧЕТА ГИЛЬДИИ</span>
        <button class="modal-close" @click="close">✕</button>
      </div>
      <div v-if="isLoading" class="loading-indicator"><div class="spinner"></div><div class="loading-text">Загрузка...</div></div>
      <div class="modal-body">
        <div v-if="!authenticated" class="password-section">
          <div class="field-label">🔐 Доступ защищен паролем</div>
          <input type="password" v-model="password" placeholder="Введите пароль" @keyup.enter="checkPassword" autofocus />
          <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>
        </div>
        <div v-else class="accounting-section">
          <div class="tab-bar">
            <button :class="{ active: activeTab === 'stock' }" @click="activeTab = 'stock'">📦 Склад</button>
            <button :class="{ active: activeTab === 'treasury' }" @click="activeTab = 'treasury'">💰 Казна</button>
            <button :class="{ active: activeTab === 'chart' }" @click="activeTab = 'chart'">📊 График продаж</button>
          </div>

          <!-- Склад (без изменений) -->
          <div v-if="activeTab === 'stock'" class="stock-tab">
            <!-- ... содержимое как было ... -->
            <div class="add-item-form">
              <div class="form-title">➕ Добавить предмет на склад</div>
              <div class="form-row">
                <div class="form-field"><label>Тип</label><select v-model="newItem.type"><option value="" disabled>— Выберите —</option><option v-for="t in filterTags" :key="t" :value="t">{{ t }}</option></select></div>
                <div class="form-field"><label>Название</label><input v-model="newItem.name" type="text" placeholder="например: Меч" /></div>
                <div class="form-field"><label>Кол-во</label><input v-model.number="newItem.quantity" type="number" placeholder="1" /></div>
                <button @click="addStockItem" class="add-btn">➕ Добавить</button>
              </div>
            </div>
            <div class="section-title-small">Предметы гильдии</div>
            <div class="filter-tags"><button v-for="tag in filterTags" :key="tag" class="tag-btn" :class="{ active: activeTypeFilter === tag }" @click="activeTypeFilter = activeTypeFilter === tag ? '' : tag">{{ tag }}</button></div>
            <div class="stock-filters"><input type="text" v-model="stockSearch" placeholder="🔍 Поиск по названию..." class="search-input" /></div>
            <div class="stock-table-container">
              <table class="stock-table"><thead><tr><th>ID</th><th>Тип</th><th>Название</th><th>Кол-во</th><th>Дата</th><th>Действие</th></tr></thead>
              <tbody>
                <tr v-for="item in filteredStock" :key="item.id">
                  <td>{{ item.id }}</td>
                  <td>{{ item.tape }}</td>
                  <td>{{ item.name }}</td>
                  <td>{{ item.quantity }}</td>
                  <td>{{ item.date }}</td>
                  <td>
                    <button class="sell-btn" @click="openSellDialog(item)">💰 Продать</button>
                    <button class="remove-btn" @click="openRemoveDialog(item)">🗑️ Удалить</button>
                  </td>
                </tr>
                <tr v-if="filteredStock.length === 0"><td colspan="6" class="empty-row">Нет записей</td></tr>
              </tbody>
              </table>
            </div>
          </div>

          <!-- Казна (без изменений) -->
          <div v-if="activeTab === 'treasury'" class="treasury-tab">
            <div class="treasury-summary"><div class="total-sum-label">Текущий баланс казны</div><div class="total-sum-value">{{ treasury.total }}</div></div>
            <div class="treasury-actions">
              <div class="action-card income-card"><div class="action-title">💰 Пополнение</div><div class="action-fields"><input type="number" v-model.number="incomeAmount" placeholder="Сумма" class="amount-input" /><input type="text" v-model="incomeNote" placeholder="Комментарий" class="note-input" /><button @click="addIncome" class="action-btn income-btn">➕ Добавить</button></div></div>
              <div class="action-card expense-card"><div class="action-title">💸 Расход</div><div class="action-fields"><input type="number" v-model.number="expenseAmount" placeholder="Сумма" class="amount-input" /><input type="text" v-model="expenseNote" placeholder="Комментарий" class="note-input" /><button @click="addExpense" class="action-btn expense-btn">➖ Списать</button></div></div>
            </div>
            <div class="section-title-small">📜 История операций</div>
            <div class="history-table-container"><table class="history-table"><thead><tr><th>Дата</th><th>Тип</th><th>Сумма</th><th>Комментарий</th></tr></thead>
            <tbody><tr v-for="op in treasury.history.slice().reverse().slice(0,20)" :key="op.date + op.amount + op.note"><td class="history-date">{{ op.date }}</td><td><span :class="op.type === 'income' ? 'badge-income' : 'badge-expense'">{{ op.type === 'income' ? 'Пополнение' : 'Расход' }}</span></td><td :class="op.type === 'income' ? 'amount-income' : 'amount-expense'">{{ op.type === 'income' ? '+' : '-' }}{{ op.amount }}</td><td class="history-note">{{ op.note || '—' }}</td></tr>
            <tr v-if="treasury.history.length === 0"><td colspan="4" class="empty-row">Нет операций</td></tr></tbody></table></div>
          </div>

          <!-- График продаж (новая вкладка) -->
          <div v-if="activeTab === 'chart'" class="chart-tab">
            <div class="section-title-small">📊 Количество проданных единиц по предметам</div>
            <div v-if="chartData.series.length === 0" class="empty-chart">
              Нет данных о продажах
            </div>
            <div v-else class="chart-container">
              <apexchart type="pie" :options="chartOptions" :series="chartData.series"></apexchart>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer"><button class="btn-cancel" @click="close">Закрыть</button><button v-if="authenticated" class="btn-refresh" @click="refreshData">🔄 Обновить</button></div>
    </div>

    <!-- Модалка продажи -->
    <div v-if="sellDialog.visible" class="modal-overlay nested" @click.self="closeSellDialog">
      <div class="sell-modal">
        <div class="sell-header">Продажа: {{ sellDialog.itemName }}</div>
        <div class="sell-body">
          <div v-if="!sellDialog.loading">
            <div class="sell-field"><label>Количество (макс. {{ sellDialog.maxQuantity }}):</label><input type="number" v-model.number="sellDialog.quantity" :max="sellDialog.maxQuantity" min="1" /></div>
            <div class="sell-field"><label>Сумма продажи:</label><input type="number" v-model.number="sellDialog.amount" min="0" step="any" /></div>
            <div class="sell-error" v-if="sellDialog.error">{{ sellDialog.error }}</div>
          </div>
          <div v-else class="sell-loading"><div class="spinner"></div><div class="loading-text">Обработка...</div></div>
        </div>
        <div class="sell-footer" v-if="!sellDialog.loading"><button @click="closeSellDialog" class="btn-cancel">Отмена</button><button @click="confirmSell" class="btn-sell">✅ Подтвердить продажу</button></div>
      </div>
    </div>

    <!-- Модалка удаления -->
    <div v-if="removeDialog.visible" class="modal-overlay nested" @click.self="closeRemoveDialog">
      <div class="sell-modal">
        <div class="sell-header">Удаление: {{ removeDialog.itemName }}</div>
        <div class="sell-body">
          <div v-if="!removeDialog.loading">
            <div class="sell-field"><label>Количество для удаления (макс. {{ removeDialog.maxQuantity }}):</label><input type="number" v-model.number="removeDialog.quantity" :max="removeDialog.maxQuantity" min="1" /></div>
            <div class="sell-error" v-if="removeDialog.error">{{ removeDialog.error }}</div>
          </div>
          <div v-else class="sell-loading"><div class="spinner"></div><div class="loading-text">Удаление...</div></div>
        </div>
        <div class="sell-footer" v-if="!removeDialog.loading"><button @click="closeRemoveDialog" class="btn-cancel">Отмена</button><button @click="confirmRemove" class="btn-remove">🗑️ Подтвердить удаление</button></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import VueApexCharts from 'vue3-apexcharts';
const ApexChart = VueApexCharts;

const props = defineProps({ visible: Boolean });
const emit = defineEmits(['close']);

const API_URL = 'https://script.google.com/macros/s/AKfycbzbemALUDRPUjW4BLIw3IwxRLv8bnuaUNvHEuOoCJJwGhV8okebtRaebd0rDRHE8LdCRA/exec';
const PASSWORD = 'fkmrYgld';

const authenticated = ref(false);
const password = ref('');
const errorMsg = ref('');
const stockItems = ref([]);
const treasury = ref({ total: 0, history: [] });
const activeTab = ref('stock');
const stockSearch = ref('');
const incomeAmount = ref(null);
const expenseAmount = ref(null);
const incomeNote = ref('');
const expenseNote = ref('');
const filterTags = ['Оружие', 'Расходник', 'Ресурс'];
const activeTypeFilter = ref('');
const newItem = ref({ type: '', name: '', quantity: 1 });
const isLoading = ref(false);
let autoUpdateInterval = null;

// Диалоги
const sellDialog = ref({ visible: false, itemId: null, itemName: '', maxQuantity: 0, quantity: 1, amount: 0, error: '', loading: false });
const removeDialog = ref({ visible: false, itemId: null, itemName: '', maxQuantity: 0, quantity: 1, error: '', loading: false });

// Данные для графика
const chartData = computed(() => {
  // Фильтруем предметы с sold_qty > 0
  const itemsWithSales = stockItems.value.filter(item => item.sold_qty && item.sold_qty > 0);
  const series = itemsWithSales.map(item => item.sold_qty);
  const labels = itemsWithSales.map(item => item.name);
  return { series, labels };
});

const chartOptions = computed(() => ({
  chart: {
    width: '350px',
    height: '350px',
    type: 'pie',
    background: 'transparent',
    toolbar: { show: false }
  },
  labels: chartData.value.labels,
  colors: ['#8b2500', '#6b1c00', '#5c3a1e', '#4a2e18', '#7a3a1a', '#9a4a2a', '#3e2a1a', '#8b5a3a'],
  theme: { mode: 'dark' },
  tooltip: {
    enabled: true,
    theme: 'dark',
    style: { fontSize: '12px', fontFamily: 'Cinzel, serif' },
    y: { formatter: (val) => `${val} шт.` }
  },
  legend: {
    position: 'bottom',
    labels: { colors: '#e8dcc8', fontFamily: 'Cinzel, serif', fontSize: '11px' },
    itemMargin: { horizontal: 8, vertical: 4 }
  },
  dataLabels: {
    enabled: true,
    style: {
      colors: ['#ffffff'],           // белый текст
      fontSize: '13px',              // крупнее
      fontFamily: 'Cinzel, serif',
      fontWeight: 'bold'
    },
    formatter: (val, opts) => `${opts.w.config.series[opts.seriesIndex]} шт.`,
    dropShadow: {                    // тень для читаемости на тёмных секторах
      enabled: true,
      top: 1,
      left: 1,
      blur: 2,
      color: '#000',
      opacity: 0.5
    }
  },
  responsive: [{
    breakpoint: 480,
    options: {
      chart: { width: '280px', height: '280px' },
      legend: { position: 'bottom' },
      dataLabels: { style: { fontSize: '11px' } }
    }
  }]
}));

// API вызовы (без изменений)
async function callApi(action, body = {}) {
  let url = API_URL;
  if (!action) {
    url = `${API_URL}?password=${encodeURIComponent(PASSWORD)}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  } else {
    const formData = new FormData();
    formData.append('password', PASSWORD);
    formData.append('action', action);
    Object.keys(body).forEach(k => formData.append(k, body[k]));
    const res = await fetch(API_URL, { method: 'POST', body: formData });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  }
}
async function fetchAccountingData() {
  isLoading.value = true;
  try {
    const data = await callApi();
    stockItems.value = data.stock || [];
    treasury.value = { total: data.total || 0, history: data.history || [] };
  } catch (err) { errorMsg.value = err.message; }
  finally { isLoading.value = false; }
}
async function addStockItem() {
  if (!newItem.value.type || !newItem.value.name || !newItem.value.quantity) {
    alert('Заполните тип, название и количество');
    return;
  }
  isLoading.value = true;
  try {
    await callApi('addStock', { 
      type: newItem.value.type, 
      name: newItem.value.name, 
      quantity: newItem.value.quantity, 
      score: 0, 
      player: 'Неизвестно' 
    });
    await fetchAccountingData();
    // Сохраняем последний выбранный тип, сбрасываем только название и количество
    newItem.value = { type: newItem.value.type, name: '', quantity: 1 };
  } catch (err) { 
    alert('Ошибка: ' + err.message); 
  } finally { 
    isLoading.value = false; 
  }
}
async function addIncome() {
  if (!incomeAmount.value || incomeAmount.value <= 0) return;
  isLoading.value = true;
  try {
    await callApi('addIncome', { amount: incomeAmount.value, note: incomeNote.value });
    await fetchAccountingData();
    incomeAmount.value = null; incomeNote.value = '';
  } catch (err) { alert('Ошибка: ' + err.message); } finally { isLoading.value = false; }
}
async function addExpense() {
  if (!expenseAmount.value || expenseAmount.value <= 0) return;
  isLoading.value = true;
  try {
    await callApi('addExpense', { amount: expenseAmount.value, note: expenseNote.value });
    await fetchAccountingData();
    expenseAmount.value = null; expenseNote.value = '';
  } catch (err) { alert('Ошибка: ' + err.message); } finally { isLoading.value = false; }
}
async function refreshData() { await fetchAccountingData(); }
function checkPassword() {
  if (password.value === PASSWORD) {
    authenticated.value = true;
    fetchAccountingData();
    errorMsg.value = '';
    if (autoUpdateInterval) clearInterval(autoUpdateInterval);
    autoUpdateInterval = setInterval(() => { if (authenticated.value) fetchAccountingData(); }, 30000);
  } else { errorMsg.value = 'Неверный пароль'; password.value = ''; }
}
function openSellDialog(item) {
  sellDialog.value = { visible: true, itemId: item.id, itemName: item.name, maxQuantity: item.quantity, quantity: 1, amount: 0, error: '', loading: false };
}
function closeSellDialog() {
  sellDialog.value.visible = false;
  sellDialog.value.loading = false;
  sellDialog.value.error = '';
}
async function confirmSell() {
  const qty = sellDialog.value.quantity;
  const amt = sellDialog.value.amount;
  if (!qty || qty < 1 || qty > sellDialog.value.maxQuantity) {
    sellDialog.value.error = `Введите количество от 1 до ${sellDialog.value.maxQuantity}`;
    return;
  }
  if (amt === undefined || amt === null || amt < 0) {
    sellDialog.value.error = 'Введите сумму продажи';
    return;
  }
  sellDialog.value.loading = true;
  sellDialog.value.error = '';
  try {
    await callApi('sellItem', { id: sellDialog.value.itemId, quantity: qty, amount: amt });
    await fetchAccountingData();
    closeSellDialog();
  } catch (err) {
    sellDialog.value.error = err.message;
    sellDialog.value.loading = false;
  }
}
function openRemoveDialog(item) {
  removeDialog.value = { visible: true, itemId: item.id, itemName: item.name, maxQuantity: item.quantity, quantity: 1, error: '', loading: false };
}
function closeRemoveDialog() {
  removeDialog.value.visible = false;
  removeDialog.value.loading = false;
  removeDialog.value.error = '';
}
async function confirmRemove() {
  const qty = removeDialog.value.quantity;
  if (!qty || qty < 1 || qty > removeDialog.value.maxQuantity) {
    removeDialog.value.error = `Введите количество от 1 до ${removeDialog.value.maxQuantity}`;
    return;
  }
  removeDialog.value.loading = true;
  removeDialog.value.error = '';
  try {
    await callApi('removeItem', { id: removeDialog.value.itemId, quantity: qty });
    await fetchAccountingData();
    closeRemoveDialog();
  } catch (err) {
    removeDialog.value.error = err.message;
    removeDialog.value.loading = false;
  }
}
watch(() => props.visible, (newVal) => {
  if (!newVal) {
    authenticated.value = false; password.value = ''; errorMsg.value = ''; activeTab.value = 'stock'; stockSearch.value = ''; activeTypeFilter.value = '';
    if (autoUpdateInterval) { clearInterval(autoUpdateInterval); autoUpdateInterval = null; }
    closeSellDialog();
    closeRemoveDialog();
  } else { authenticated.value = false; password.value = ''; errorMsg.value = ''; }
});
onBeforeUnmount(() => { if (autoUpdateInterval) clearInterval(autoUpdateInterval); });
function close() { emit('close'); }
const filteredStock = computed(() => {
  let filtered = stockItems.value;
  filtered = filtered.filter(item => item.quantity > 0);
  if (activeTypeFilter.value) filtered = filtered.filter(item => item.tape === activeTypeFilter.value);
  if (stockSearch.value) {
    const s = stockSearch.value.toLowerCase();
    filtered = filtered.filter(item => item.name.toLowerCase().includes(s));
  }
  return filtered;
});
</script>

<style scoped>
/* Все стили из предыдущей версии + добавить для графика */
.modal-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);backdrop-filter:blur(5px);z-index:10000;display:flex;align-items:center;justify-content:center;}
.modal-container{width:90%;max-width:900px;max-height:85vh;background:linear-gradient(135deg,#1e1a16,#2a241f);border-radius:12px;border:2px solid #8b7355;display:flex;flex-direction:column;overflow:hidden;color:#f0e6d0;font-family:'Crimson Text',serif;position:relative;}
.accounting-modal *{color:#f0e6d0;}
.modal-header{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#0f0c09;border-bottom:1px solid #8b7355;font-family:'Cinzel',serif;font-weight:bold;}
.modal-close{background:none;border:none;font-size:24px;cursor:pointer;color:#e8dcc8;}
.modal-body{flex:1;overflow-y:auto;padding:16px;}
.loading-indicator{position:absolute;top:12px;right:50px;z-index:2100;display:flex;align-items:center;gap:8px;background:rgba(0,0,0,0.7);padding:6px 12px;border-radius:8px;font-family:'Cinzel',serif;backdrop-filter:blur(4px);border:1px solid #8b7355;}
.spinner{width:16px;height:16px;border:2px solid #e8dcc8;border-top:2px solid #8b2500;border-radius:50%;animation:spin 1s linear infinite;}
@keyframes spin{0%{transform:rotate(0deg);}100%{transform:rotate(360deg);}}
.loading-text{color:#e8dcc8;font-size:11px;}
.password-section{text-align:center;padding:20px;}
.password-section input{width:200px;padding:8px;margin-top:10px;background:#2a241f;border:1px solid #8b7355;border-radius:4px;color:#f0e6d0;}
.error-msg{color:#e08060;margin-top:8px;font-size:12px;}
.tab-bar{display:flex;gap:10px;margin-bottom:20px;border-bottom:2px solid #5c4a3a;}
.tab-bar button{background:none;border:none;padding:8px 16px;font-family:'Cinzel',serif;font-weight:bold;cursor:pointer;color:#b8a88a;}
.tab-bar button.active{color:#e8a870;border-bottom:3px solid #c4713b;}
.section-title-small{font-family:'Cinzel',serif;font-weight:bold;margin:16px 0 8px 0;border-left:4px solid #c4713b;padding-left:8px;color:#e8c8a0;font-size:14px;}
.stock-filters{margin-bottom:12px;}
.search-input{width:100%;padding:8px;border:1px solid #5c4a3a;border-radius:4px;background:#2a241f;color:#f0e6d0;font-size:13px;}
.stock-table-container{overflow-x:auto;}
.stock-table{width:100%;border-collapse:collapse;font-size:13px;}
.stock-table th,.stock-table td{border:1px solid #5c4a3a;padding:8px 6px;text-align:left;}
.stock-table th{background:#3a2e26;font-family:'Cinzel',serif;}
.treasury-summary{background:linear-gradient(135deg,#2a241f,#1e1a16);border-radius:12px;padding:20px;text-align:center;margin-bottom:20px;border:1px solid #c4713b;}
.total-sum-label{font-family:'Cinzel',serif;font-size:14px;letter-spacing:2px;color:#b8a88a;margin-bottom:8px;}
.total-sum-value{font-size:42px;font-weight:bold;font-family:'Cinzel',serif;color:#e8a870;text-shadow:0 0 8px rgba(200,120,50,0.3);}
.treasury-actions{display:flex;gap:20px;flex-wrap:wrap;margin-bottom:24px;}
.action-card{flex:1;background:rgba(0,0,0,0.3);border-radius:10px;padding:14px;border-left:4px solid;}
.income-card{border-left-color:#80c080;}
.expense-card{border-left-color:#e08060;}
.action-title{font-family:'Cinzel',serif;font-size:15px;font-weight:bold;margin-bottom:12px;}
.action-fields{display:flex;flex-wrap:wrap;gap:10px;align-items:center;}
.amount-input,.note-input{padding:8px;background:#2a241f;border:1px solid #5c4a3a;border-radius:4px;color:#f0e6d0;font-size:14px;}
.amount-input{width:110px;}
.note-input{flex:2;min-width:150px;}
.action-btn{padding:8px 14px;border:none;border-radius:4px;font-family:'Cinzel',serif;font-weight:bold;cursor:pointer;font-size:13px;}
.income-btn{background:#2c6e2c;color:white;}
.expense-btn{background:#8b3a2a;color:white;}
.history-table-container{overflow-x:auto;margin-top:12px;}
.history-table{width:100%;border-collapse:collapse;font-size:14px;}
.history-table th{background:#3a2e26;font-family:'Cinzel',serif;padding:10px 8px;text-align:left;border-bottom:2px solid #c4713b;font-size:14px;}
.history-table td{padding:10px 8px;border-bottom:1px solid #5c4a3a;font-size:14px;}
.badge-income{background:#2c6e2c;padding:4px 10px;border-radius:16px;font-size:12px;font-weight:bold;}
.badge-expense{background:#8b3a2a;padding:4px 10px;border-radius:16px;font-size:12px;font-weight:bold;}
.amount-income{color:#80c080;font-weight:bold;}
.amount-expense{color:#e08060;font-weight:bold;}
.history-date{font-family:monospace;white-space:nowrap;font-size:13px;}
.history-note{max-width:250px;word-break:break-word;}
.empty-row{text-align:center;padding:20px;color:#a09080;}
.modal-footer{display:flex;justify-content:flex-end;gap:12px;padding:12px 16px;border-top:1px solid #5c4a3a;}
.btn-cancel,.btn-refresh{padding:6px 12px;border-radius:4px;cursor:pointer;font-family:'Cinzel',serif;font-size:12px;}
.btn-cancel{background:transparent;border:1px solid #8b7355;color:#e8dcc8;}
.btn-refresh{background:#5c4a3a;border:none;color:#f0e6d0;}
.add-item-form{background:rgba(0,0,0,0.4);padding:14px;border-radius:8px;margin-bottom:20px;}
.form-title{font-family:'Cinzel',serif;font-size:13px;margin-bottom:12px;color:#e8c8a0;letter-spacing:1px;}
.form-row{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;}
.form-field{display:flex;flex-direction:column;gap:4px;flex:1;min-width:90px;}
.form-field label{font-size:11px;font-family:'Cinzel',serif;color:#b8a88a;text-transform:uppercase;}
.form-field select,.form-field input{background:#2a241f;border:1px solid #5c4a3a;border-radius:4px;padding:8px;color:#f0e6d0;font-size:13px;}
.add-btn{background:#8b2500;border:none;border-radius:4px;padding:8px 18px;color:white;cursor:pointer;font-family:'Cinzel',serif;font-weight:bold;height:38px;align-self:flex-end;}
.filter-tags{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;}
.tag-btn{background:#5c4a3a;border:none;border-radius:4px;padding:6px 12px;color:#f0e6d0;cursor:pointer;font-family:'Cinzel',serif;font-weight:bold;font-size:12px;}
.tag-btn.active{background:#8b2500;box-shadow:0 0 4px #c4713b;}
.sell-btn,.remove-btn{background:#8b3a2a;border:none;border-radius:4px;padding:4px 12px;color:white;cursor:pointer;font-family:'Cinzel',serif;font-size:12px;}
.sell-btn:hover,.remove-btn:hover{background:#a54a38;}
.remove-btn{background:#5c4a3a;margin-left:8px;}
.remove-btn:hover{background:#7a6248;}
.modal-overlay.nested{background:rgba(0,0,0,0.7);backdrop-filter:blur(2px);z-index:10001;}
.sell-modal{background:#2a241f;border:2px solid #8b7355;border-radius:12px;width:320px;max-width:90%;padding:20px;font-family:'Cinzel',serif;}
.sell-header{font-size:18px;font-weight:bold;margin-bottom:16px;color:#e8a870;text-align:center;}
.sell-body{margin-bottom:20px;}
.sell-field{margin-bottom:12px;}
.sell-field label{display:block;font-size:12px;color:#b8a88a;margin-bottom:4px;}
.sell-field input{width:100%;padding:8px;background:#1e1a16;border:1px solid #5c4a3a;border-radius:4px;color:#f0e6d0;}
.sell-error{color:#e08060;font-size:12px;margin-top:8px;text-align:center;}
.sell-footer{display:flex;justify-content:flex-end;gap:12px;}
.btn-sell,.btn-remove{background:#2c6e2c;border:none;border-radius:4px;padding:6px 12px;color:white;cursor:pointer;}
.btn-remove{background:#8b3a2a;}
.sell-loading{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;gap:12px;}
.sell-loading .spinner{width:32px;height:32px;border:3px solid #e8dcc8;border-top:3px solid #8b2500;border-radius:50%;animation:spin 1s linear infinite;}
.sell-loading .loading-text{font-family:'Cinzel',serif;font-size:14px;color:#e8dcc8;}
.chart-tab{padding: 10px 0;}
.chart-container{background: rgba(0,0,0,0.3); border-radius: 12px; padding: 16px; margin-top: 8px;}
.empty-chart{text-align:center; padding: 40px; color: #b8a88a; font-family: 'Cinzel', serif;}
.chart-container {
  background: rgba(0,0,0,0.3);
  border-radius: 12px;
  padding: 16px;
  margin-top: 8px;
  display: flex;
  justify-content: center;
  align-items: center;
}

:deep(.apexcharts-tooltip) {
  background: #2a241f !important;
  border: 1px solid #8b7355 !important;
  border-radius: 8px !important;
  color: #ffffff !important;
  font-family: 'Cinzel', serif !important;
}
:deep(.apexcharts-tooltip-title) {
  background: #1e1a16 !important;
  border-bottom: 1px solid #8b7355 !important;
  color: #ffffff !important;
}
:deep(.apexcharts-tooltip-text-y-label),
:deep(.apexcharts-tooltip-text-y-value) {
  color: #ffffff !important;
}
</style>