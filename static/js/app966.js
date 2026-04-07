const aboutToggle = document.getElementById('about-toggle');
const aboutDropdown = document.getElementById('about-dropdown');
const accountInput = document.getElementById('account-id');
const accountEmail = document.getElementById('account-email');
const addAccountBtn = document.getElementById('add-account-btn');
const delAccountBtn = document.getElementById('del-account-btn');
const redeemAllBtn = document.getElementById('redeem-all-btn');
const redeemAllBtn2 = document.getElementById('redeem-all-btn2');
const manualAccountInput = document.getElementById('manual-account-id');
const redeemCodeInput = document.getElementById('redeem-code');
const redeemBtn = document.getElementById('redeem-btn');
const exchangeList = document.getElementById('exchange-list');
const codeList = document.getElementById('code-list');
const loadMoreBtn = document.getElementById('load-more-btn');
const themeToggle = document.querySelector('.input__check');
const refreshExchange = document.getElementById('refresh-exchange');
const refreshCodes = document.getElementById('refresh-codes');
const messageModal = document.getElementById('message-modal');
const messageTitle = document.getElementById('message-title');
const messageContent = document.getElementById('message-content');
const messageIcon = document.getElementById('message-icon');
const messageOk = document.getElementById('message-ok');
const rewardToggle = document.getElementById('reward-toggle');
const rewardModal = document.getElementById('reward-modal');
const rewardClose = document.getElementById('reward-close');
const saveAlipayBtn = document.getElementById('save-alipay-btn');
const saveWechatBtn = document.getElementById('save-wechat-btn');
const alipayQrcode = document.getElementById('alipay-qrcode');
const wechatQrcode = document.getElementById('wechat-qrcode');
const aboutQqCopy = document.getElementById('about-qq-copy');
const aboutWechatCopy = document.getElementById('about-wechat-copy');

// 添加兑换码相关元素
const addcodeToggle = document.getElementById('about-addcode-toggle');
const addcodeModal = document.getElementById('addcode-modal');
const addcodeClose = document.getElementById('addcode-close');
const codeInput = document.getElementById('code-input');
const expiryDateInput = document.getElementById('expiry-date');
const adminPasswordInput = document.getElementById('admin-password');
const submitAddcodeBtn = document.getElementById('submit-addcode');
const codeTypeRadios = document.querySelectorAll('input[name="code-type"]');
const typeOptions = document.querySelectorAll('.type-option');
const dateRequiredIndicator = document.getElementById('date-required-indicator');
const dateStatusBadge = document.getElementById('date-status-badge');
const dateHint = document.getElementById('date-hint');
const expiryDateContainer = document.getElementById('expiry-date-container');
const dateStar = document.getElementById('date-required-indicator');

let messageResolve;
let currentPage = 1;
const pageSize = 10;
let displayedRecords = [];
let redeemCodes = [];

function showMessage(message, title = '提示', type = 'info') {
    messageTitle.textContent = title;
    messageContent.textContent = message;

    switch (type) {
        case 'success':
            messageIcon.className = 'fas fa-check-circle text-green-600 dark:text-green-400';
            messageIcon.parentElement.className = messageIcon.parentElement.className.replace('bg-blue-100', 'bg-green-100').replace('dark:bg-blue-900', 'dark:bg-green-900');
            break;
        case 'error':
            messageIcon.className = 'fas fa-exclamation-circle text-red-600 dark:text-red-400';
            messageIcon.parentElement.className = messageIcon.parentElement.className.replace('bg-blue-100', 'bg-red-100').replace('dark:bg-blue-900', 'dark:bg-red-900');
            break;
        case 'warning':
            messageIcon.className = 'fas fa-exclamation-triangle text-yellow-600 dark:text-yellow-400';
            messageIcon.parentElement.className = messageIcon.parentElement.className.replace('bg-blue-100', 'bg-yellow-100').replace('dark:bg-blue-900', 'dark:bg-yellow-900');
            break;
        default:
            messageIcon.className = 'fas fa-info-circle text-blue-600 dark:text-blue-400';
            messageIcon.parentElement.className = 'flex-shrink-0 w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center';
    }

    messageModal.classList.remove('hidden');

    return new Promise((resolve) => {
        messageResolve = resolve;
    });
}

messageOk.addEventListener('click', function () {
    messageModal.classList.add('hidden');
    if (messageResolve) {
        messageResolve(true);
    }
});

messageModal.addEventListener('click', function (e) {
    if (e.target === messageModal) {
        messageModal.classList.add('hidden');
        if (messageResolve) {
            messageResolve(true);
        }
    }
});

async function getSignedUrl(data, post = null) {
    const signer = new ApiSigner();
    return await signer.generateSignature(data, post);
}

async function getGiftCode(page, size) {
    page = page || 1;
    size = size || 20;

    try {
        const params = {
            page: page,
            size: size
        };
        let signature = await getSignedUrl(params);
        let url = `/api/r/getGiftCode${signature.url}`;
        const res = await fetch(url, {
            method: 'GET',
        });

        return await res.json();

    } catch (error) {
        await showMessage(`获取近期兑换失败，原因：${String(error)}`, '失败', 'error');
        return {data: [], has_next: false};
    }
}

async function giftCode(accountId, code) {
    if (!accountId || !code) {
        showToast('请输入正确的账号和兑换码', 'error');
        return undefined;
    }

    try {
        const data = {
            fid: accountId,
            cdk: code
        };

        let signature = await getSignedUrl(null, data);
        let url = `/api/giftCode${signature.url}`;

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data),
        });

        return await res.json();

    } catch (error) {
        await showMessage(`兑换失败，原因：${String(error)}`, '失败', 'error');
        return undefined;
    }
}

async function giftCodeAll(accountId, t='0') {
    if (!accountId) {
        showToast('请输入正确的账号', 'error');
        return undefined;
    }

    try {
        const data = {
            fid: accountId,
            type: t
        };

        let signature = await getSignedUrl(null, data);
        let url = `/api/giftCodeAll${signature.url}`;

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data),
        });
        return await res.json();
    } catch (error) {
        await showMessage(`兑换失败，原因：${String(error)}`, '请求失败', 'error');
        return undefined;
    }
}

async function delUser(accountId, email) {
    if (!accountId || !email) {
        showToast('请输入正确的账号', 'error');
        return undefined;
    }

    try {
        const data = {
            fid: accountId,
            email: email
        };

        let signature = await getSignedUrl(null, data);
        let url = `/api/delUser${signature.url}`;

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data),
        });

        return await res.json();
    } catch (error) {
        await showMessage(`删除失败，原因：${String(error)}`, '请求失败', 'error');
        return undefined;
    }
}

async function addUser(accountId, email) {
    if (!accountId || !email) {
        showToast('请输入正确的账号和邮箱', 'error');
        return undefined;
    }

    try {
        const data = {
            fid: accountId,
            email: email
        };

        let signature = await getSignedUrl(null, data);
        let url = `/api/addUser${signature.url}`;

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data),
        });

        return await res.json();
    } catch (error) {
        await showMessage(`添加失败，原因：${String(error)}`, '请求失败', 'error');
        return undefined;
    }
}

async function getGiftCodeAll() {
    try {
        let signature = await getSignedUrl(null);
        let url = `/api/getGiftCode${signature.url}`;

        const res = await fetch(url, {
            method: 'GET',
        });

        return await res.json();

    } catch (error) {
        await showMessage(`获取兑换码列表失败，原因：${String(error)}`, '失败', 'error');
        return {data: []};
    }
}

async function getDanmuAll() {
    try {
        let signature = await getSignedUrl(null);
        let url = `/api/getDanmu${signature.url}`;

        const res = await fetch(url, {
            method: 'GET',
        });

        return await res.json();

    } catch (error) {
        showToast(`获取赞助弹幕列表失败，原因：${String(error)}`, 'error');
        return {data: []};
    }
}

function updateThemeToggle(isDarkMode, saveToStorage = true) {
    if (isDarkMode) {
        document.documentElement.classList.add('dark');
        if (themeToggle) {
            themeToggle.checked = true;
            themeToggle.setAttribute('checked', 'checked');
        }
        if (saveToStorage) {
            localStorage.setItem('theme', 'dark');
        }
    } else {
        document.documentElement.classList.remove('dark');
        if (themeToggle) {
            themeToggle.checked = false;
            themeToggle.removeAttribute('checked');
        }
        if (saveToStorage) {
            localStorage.setItem('theme', 'light');
        }
    }
}

// 兑换码相关函数
function resetAddCodeForm() {
    if (!codeInput || !expiryDateInput || !adminPasswordInput) return;

    codeInput.value = '';
    expiryDateInput.value = '';
    adminPasswordInput.value = '';

    // 重置类型选择
    if (document.querySelector('input[name="code-type"][value="0"]')) {
        document.querySelector('input[name="code-type"][value="0"]').checked = true;
    }
    if (document.querySelector('input[name="code-type"][value="1"]')) {
        document.querySelector('input[name="code-type"][value="1"]').checked = false;
    }

    // 重置类型选项样式
    if (typeOptions.length > 0) {
        typeOptions.forEach(option => {
            option.addEventListener('click', function() {
                const type = this.getAttribute('data-type');
                // 1. 切换视觉选中的 UI 效果 (Tailwind border)
                typeOptions.forEach(opt => opt.classList.replace('border-primary-500', 'border-slate-200'));
                this.classList.replace('border-slate-200', 'border-primary-500');

                // 2. 星号显示/隐藏逻辑
                if (type === '1') { // 限时兑换
                    dateStar.classList.remove('hidden');
                    // 3. 自动设置日期为今天的第2天
                    const now = new Date();
                    const beijingTimestamp = now.getTime() + (8 * 60 * 60 * 1000);
                    const beijingDate = new Date(beijingTimestamp);
                    beijingDate.setDate(beijingDate.getDate() + 2);
                    expiryDateInput.value = beijingDate.toISOString().split('T')[0];
                } else { // 长期有效
                    dateStar.classList.add('hidden');
                    expiryDateInput.value = '';
                }
            });
        });
    }

    // 辅助：点击图标区域触发隐藏的 Radio Input (确保点击文字也能选中)
    typeOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            const input = opt.querySelector('input[type="radio"]');
            if (input) input.checked = true;
        });
    });

    // 初始化日期字段状态
    updateDateFieldState('0');

    // 重新验证表单
    validateAddcodeForm();
}

function openAddcodeModal() {
    resetAddCodeForm();
    if (addcodeModal) {
        addcodeModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        setTimeout(() => {
            if (codeInput) codeInput.focus();
        }, 100);
    }
}

function closeAddcodeModal() {
    if (addcodeModal) {
        addcodeModal.classList.add('hidden');
        document.body.style.overflow = '';
    }
}

function updateDateFieldState(selectedType) {
    if (!expiryDateInput || !dateRequiredIndicator || !dateStatusBadge || !dateHint || !expiryDateContainer) return;

    const isLimited = selectedType === '1';

    if (isLimited) {
        // 限时兑换：必填
        expiryDateInput.required = true;
        dateRequiredIndicator.classList.remove('hidden');
        dateStatusBadge.textContent = '必填';
        dateStatusBadge.className = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100';
        dateHint.textContent = '请选择兑换码的有效截止日期';
        expiryDateContainer.classList.add('opacity-100');
    } else {
        // 长期有效：可选
        expiryDateInput.required = false;
        dateRequiredIndicator.classList.add('hidden');
        dateStatusBadge.textContent = '可选';
        dateStatusBadge.className = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
        dateHint.textContent = '长期有效的兑换码无需选择日期';
        expiryDateContainer.classList.remove('opacity-100');
    }
}

function validateAddcodeForm() {
    if (!codeInput || !adminPasswordInput || !expiryDateInput || !submitAddcodeBtn) return;

    const code = codeInput.value.trim();
    const password = adminPasswordInput.value.trim();
    const expiryDate = expiryDateInput.value;

    // 获取选中的类型
    let selectedType = '0';
    if (codeTypeRadios && codeTypeRadios.length > 0) {
        codeTypeRadios.forEach(radio => {
            if (radio.checked) {
                selectedType = radio.value;
            }
        });
    }

    // 基础验证
    let isValid = code && code.length > 0 && password && password.length > 0;

    // 如果是限时兑换，检查日期
    if (selectedType === '1') {
        isValid = isValid && expiryDate && expiryDate.length > 0;

        // 日期验证：不能选择过去的日期
        if (expiryDate) {
            const selectedDate = new Date(expiryDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (selectedDate < today) {
                expiryDateInput.classList.add('border-red-500', 'dark:border-red-500');
                expiryDateInput.classList.remove('border-green-500', 'dark:border-green-500');
            } else {
                expiryDateInput.classList.remove('border-red-500', 'dark:border-red-500');
                expiryDateInput.classList.add('border-green-500', 'dark:border-green-500');
            }
        }
    } else {
        // 长期有效时清除日期验证样式
        expiryDateInput.classList.remove('border-red-500', 'dark:border-red-500', 'border-green-500', 'dark:border-green-500');
        expiryDateInput.classList.add('border-gray-300', 'dark:border-gray-600');
    }

    // 更新提交按钮状态
    submitAddcodeBtn.disabled = !isValid;

    // 按钮状态反馈
    if (!isValid) {
        submitAddcodeBtn.classList.remove('shadow-md', 'hover:shadow-lg');
    } else {
        submitAddcodeBtn.classList.add('shadow-md', 'hover:shadow-lg');
    }
}

async function addGiftCode(code, type = '0', endTime = '', pwd = '') {
    try {
        const data = {
            cdk: code,
            type: type,
            endTime: endTime || '',
            pwd: pwd
        };

        let signature = await getSignedUrl(null, data);
        let url = `/api/addGiftCode${signature.url}`;

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data),
        });

        return await res.json();
    } catch (error) {
        console.error('添加兑换码失败:', error);
        return { code: -1, msg: '网络请求失败' };
    }
}

document.addEventListener('DOMContentLoaded', async function () {
    const currentYearElement = document.getElementById('current-year');
    if (currentYearElement) {
        currentYearElement.textContent = new Date().getFullYear().toString();
    }

    await renderDanmaku();
    await loadExchangeRecords(1);
    let result = await getGiftCodeAll();
    redeemCodes = result.data
    renderRedeemCodes(redeemCodes);
    updateExchangeCount();

    // 初始化主题
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        updateThemeToggle(true, false);
    } else if (savedTheme === 'light') {
        updateThemeToggle(false, false);
    } else {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            updateThemeToggle(true, false);
        } else {
            updateThemeToggle(false, false);
        }
    }

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
        if (!localStorage.getItem('theme')) {
            updateThemeToggle(event.matches, false);
        }
    });

    // 初始化兑换码表单
    if (expiryDateInput) {
        expiryDateInput.min = new Date().toISOString().split('T')[0];
        validateAddcodeForm();
    }
});

// 主题切换
if (themeToggle) {
    themeToggle.addEventListener('change', function () {
        const isDarkMode = this.checked;
        updateThemeToggle(isDarkMode, true);
    });
}

// 加载兑换记录
async function loadExchangeRecords(page) {
    let res = await getGiftCode(page, pageSize);

    if (page === 1) {
        displayedRecords = res.data;
    } else {
        displayedRecords = [...displayedRecords, ...res.data];
    }

    renderExchangeRecords(displayedRecords);

    if (res.pages.has_next === false) {
        loadMoreBtn.disabled = true;
        loadMoreBtn.textContent = '没有更多数据';
        loadMoreBtn.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
        loadMoreBtn.disabled = false;
        loadMoreBtn.textContent = '加载更多';
        loadMoreBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }

    updateExchangeCount();
}

// 添加关于下拉框的切换功能
if (aboutToggle && aboutDropdown) {
    aboutToggle.addEventListener('click', function (e) {
        e.stopPropagation();
        const isHidden = aboutDropdown.classList.contains('hidden');

        if (isHidden) {
            aboutDropdown.classList.remove('hidden');
            aboutDropdown.classList.add('fade-in');
            aboutToggle.querySelector('i').style.transform = 'rotate(180deg)';
        } else {
            aboutDropdown.classList.add('hidden');
            aboutDropdown.classList.remove('fade-in');
            aboutToggle.querySelector('i').style.transform = 'rotate(0deg)';
        }
    });
}

// 点击其他地方关闭关于下拉框
document.addEventListener('click', function (e) {
    if (aboutDropdown && !aboutDropdown.contains(e.target) && aboutToggle && !aboutToggle.contains(e.target)) {
        aboutDropdown.classList.add('hidden');
        aboutDropdown.classList.remove('fade-in');
        if (aboutToggle.querySelector('i')) {
            aboutToggle.querySelector('i').style.transform = 'rotate(0deg)';
        }
    }
});

// 刷新兑换列表
if (refreshExchange) {
    refreshExchange.addEventListener('click', async function () {
        const icon = this.querySelector('i');
        icon.classList.add('spin');
        currentPage = 1;
        await loadExchangeRecords(1);
        icon.classList.remove('spin');
        showToast('近期兑换列表已刷新', 'success');
    });
}

// 加载更多按钮点击事件
if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', async function () {
        currentPage++;
        await loadExchangeRecords(currentPage);
    });
}

// 刷新兑换码列表
if (refreshCodes) {
    refreshCodes.addEventListener('click', async function () {
        const icon = this.querySelector('i');
        icon.classList.add('spin');

        let result = await getGiftCodeAll();
        if (result.data.length > 0) {
            redeemCodes = result.data;
            renderRedeemCodes(redeemCodes);
            updateCodeCount();
            icon.classList.remove('spin');
            showToast('兑换码列表已刷新', 'success');
        }
    });
}

// 显示提示
function showToast(message, type = 'success') {
    const toast = document.getElementById('copy-toast');
    if (!toast) return;

    const icon = toast.querySelector('i');
    const text = toast.querySelector('span');

    if (type === 'success') {
        toast.className = toast.className.replace('bg-red-500', 'bg-green-500');
        toast.className = toast.className.includes('bg-green-500') ? toast.className : toast.className + ' bg-green-500';
        icon.className = 'fas fa-check-circle';
    } else {
        toast.className = toast.className.replace('bg-green-500', 'bg-red-500');
        toast.className = toast.className.includes('bg-red-500') ? toast.className : toast.className + ' bg-red-500';
        icon.className = 'fas fa-exclamation-circle';
    }

    text.textContent = message;
    toast.classList.remove('hidden');

    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3500);
}

// 添加账号输入验证
function validateAddAccountForm() {
    if (!accountInput || !accountEmail || !addAccountBtn || !delAccountBtn) return;

    const accountId = accountInput.value.trim();
    const email = accountEmail.value.trim();
    const isValidEmail = validateEmail(email);
    delAccountBtn.disabled = addAccountBtn.disabled = !(accountId && isValidEmail);
}

function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// 手动兑换输入验证
function validateRedeemForm() {
    if (!manualAccountInput || !redeemCodeInput || !redeemBtn || !redeemAllBtn || !redeemAllBtn2) return;

    const accountId = manualAccountInput.value.trim();
    const code = redeemCodeInput.value.trim();
    redeemBtn.disabled = !(accountId && code);
    redeemAllBtn2.disabled = redeemAllBtn.disabled = !(accountId);
}

// 账号输入验证
if (accountInput) {
    accountInput.addEventListener('input', function () {
        this.value = this.value.replace(/\D/g, '');
        validateAddAccountForm();
    });
}

// 邮箱输入验证
if (accountEmail) {
    accountEmail.addEventListener('input', function () {
        validateAddAccountForm();
    });
}

// 手动兑换账号输入验证
if (manualAccountInput) {
    manualAccountInput.addEventListener('input', function () {
        this.value = this.value.replace(/\D/g, '');
        validateRedeemForm();
    });
}

// 兑换码输入验证
if (redeemCodeInput) {
    redeemCodeInput.addEventListener('input', function () {
        validateRedeemForm();
    });
}

// 手动兑换
if (redeemBtn) {
    redeemBtn.addEventListener('click', async function () {
        const accountId = manualAccountInput.value.trim();
        const code = redeemCodeInput.value.trim();
        if (accountId && code) {
            const originalText = redeemBtn.innerHTML;
            redeemBtn.disabled = true;
            redeemBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>兑换中...';

            try {
                let res = await giftCode(accountId, code);
                if (res === undefined) return;
                if (res.code === 0) {
                    await showMessage(`恭喜你 ${accountId} \n成功兑换: ${code}`, '成功', 'success');
                } else {
                    await showMessage(`兑换失败，${res.msg}`, '失败', 'error');
                }

            } catch (error) {
                showToast('请求失败', 'error');
            } finally {
                redeemBtn.disabled = false;
                redeemBtn.innerHTML = originalText;
                redeemCodeInput.value = '';
                validateRedeemForm();
            }
        }
    });
}

// 兑换时限
if (redeemAllBtn) {
    redeemAllBtn.addEventListener('click', async function () {
        const accountId = manualAccountInput.value.trim();
        if (accountId) {
            const originalText = redeemAllBtn.innerHTML;
            redeemAllBtn.disabled = true;
            redeemAllBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>兑换中...';
            try {
                let res = await giftCodeAll(accountId);
                if (res === undefined) return;
                await showMessage(res.msg, '操作提示', 'info');
            } catch (error) {
                showToast('请求失败', 'error');
            } finally {
                redeemAllBtn.disabled = false;
                redeemAllBtn.innerHTML = originalText;
                manualAccountInput.value = '';
                validateRedeemForm();
            }
        }
    });
}

// 兑换长效
if (redeemAllBtn2) {
    redeemAllBtn2.addEventListener('click', async function () {
        const accountId = manualAccountInput.value.trim();
        if (accountId) {
            const originalText = redeemAllBtn2.innerHTML;
            redeemAllBtn2.disabled = true;
            redeemAllBtn2.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>兑换中...';
            try {
                let res = await giftCodeAll(accountId, "1");
                if (res === undefined) return;
                await showMessage(res.msg, '操作提示', 'info');
            } catch (error) {
                showToast('请求失败', 'error');
            } finally {
                redeemAllBtn2.disabled = false;
                redeemAllBtn2.innerHTML = originalText;
                manualAccountInput.value = '';
                validateRedeemForm();
            }
        }
    });
}

// 添加账号
if (addAccountBtn) {
    addAccountBtn.addEventListener('click', async function () {
        const accountId = accountInput.value.trim();
        const email = accountEmail.value.trim();

        if (accountId && email) {
            addAccountBtn.disabled = true;
            try {
                let res = await addUser(accountId, email);
                if (res === undefined) return;
                await showMessage(res.msg, '操作提示', 'info');
            } catch (error) {
                showToast('请求失败', 'error');
            } finally {
                accountInput.value = '';
                accountEmail.value = '';
                addAccountBtn.disabled = false;
                validateAddAccountForm();
            }
        }
    });
}

// 删除账号
if (delAccountBtn) {
    delAccountBtn.addEventListener('click', async function () {
        const accountId = accountInput.value.trim();
        const email = accountEmail.value.trim();
        if (accountId && email) {
            delAccountBtn.disabled = true;
            try {
                let res = await delUser(accountId, email);
                if (res === undefined) return;
                await showMessage(res.msg, '操作提示', 'info');
            } catch (error) {
                showToast('请求失败', 'error');
            } finally {
                delAccountBtn.disabled = false;
                accountInput.value = '';
                accountEmail.value = '';
                validateAddAccountForm();
            }
        }
    });
}

function hideMiddleFour(id) {
    if (!id) return '';
    const strId = String(id);
    if (strId.length <= 8) return strId;
    const firstFour = strId.substring(0, 3);
    const lastFour = strId.substring(strId.length - 3);
    return `${firstFour}***${lastFour}`;
}

function updateCodeCount() {
    const codeCount = document.getElementById('code-count');
    if (codeCount) {
        codeCount.textContent = `(${redeemCodes.length}条)`;
    }
}

function updateExchangeCount() {
    const exchangeCount = document.getElementById('exchange-count');
    if (exchangeCount) {
        exchangeCount.textContent = `(${displayedRecords.length}条)`;
    }
}


function renderExchangeRecords(records) {
    // 渲染近期兑换列表
    exchangeList.innerHTML = '';
    records.forEach(record => {
        const recordElement = document.createElement('div');
        const hiddenFid = hideMiddleFour(record.fid);
        let displayCode = record.cdk;
        if (!displayCode) return;
        let isMultipleCodes = record.auto || false;
        let isRepeat = record.repeat || false;
        let autoInfo = isRepeat ? '兑换过了' : '自动兑换';
        let badgeColorLight = isRepeat ? 'red' : 'green';
        let badgeColorDark = isRepeat ? 'red-500' : 'green-500';
        let badgeBgDark = isRepeat ? 'red-900/40' : 'green-900/40';

        if (record.cdk && record.cdk.includes(',')) {
            const codes = record.cdk.split(',');
            displayCode = codes[0] + `(${codes.length}个)`;
        }

        recordElement.className = 'p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 transition-all duration-200 hover:shadow-sm';

        recordElement.innerHTML = `
                <!-- 移动端优化布局 -->
                <div class="flex flex-col sm:flex-row sm:items-start gap-4">
                    <!-- 头像区域 -->
                    <div class="flex items-center gap-3 sm:flex-col sm:items-start sm:gap-2">
                        <div class="relative">
                            <img src="${record.avatar_image}" alt="头像" class="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover border-2 border-white dark:border-gray-700 shadow-sm">
                            ${record.stove_lv_content && record.stove_lv_content.length > 3 ?
                `<div class="absolute -bottom-0 -right-1 w-5 h-5 rounded-full overflow-hidden border-2 border-white dark:border-gray-800 shadow-md bg-white dark:bg-gray-900">
                                <img src="${record.stove_lv_content}" alt="等级图标" class="w-full h-full object-cover">
                            </div>` :
                `<div class="absolute -bottom-0 -right-1 w-5 h-5 rounded-full border-2 border-white dark:border-gray-800 bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
                                <span class="text-xs text-white font-bold">${record.stove_lv || ''}</span>
                            </div>`
            }
                        </div>

                        <!-- 移动端昵称和ID -->
                        <div class="sm:hidden flex flex-col">
                            <div class="flex items-center gap-2">
                                <h3 class="font-semibold text-gray-900 dark:text-white text-sm truncate max-w-[120px]">${record.nickname}</h3>
                                ${isMultipleCodes ? `
                                    <span class="inline-flex items-center px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 text-xs" title="自动兑换">
                                        <i class="fas fa-robot text-xs"></i>
                                    </span>
                                ` : ''}
                            </div>
                            <div class="flex items-center gap-1 mt-1">
                                <span class="inline-flex items-center px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 text-xs">
                                    <i class="fas fa-user text-xs mr-1"></i>
                                      ${hiddenFid}
                                </span>
                                <span class="sm:hidden inline-flex items-center px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300 text-xs">
                                    <i class="fas fa-crown text-xs mr-1"></i>
                                     ${record.kid}
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- 内容区域 -->
                    <div class="flex-1 min-w-0">
                        <!-- 桌面端昵称和ID -->
                        <div class="hidden sm:flex items-center gap-1 mb-1.5">
                            <div class="flex items-center gap-2">
                                <h3 class="font-semibold text-gray-900 dark:text-white text-base truncate max-w-[80px]">${record.nickname}</h3>
                                ${isMultipleCodes ? `
                                    <span class="inline-flex items-center px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 text-xs" title="自动兑换">
                                        <i class="fas fa-robot text-xs"></i>
                                    </span>
                                ` : ''}
                            </div>
                            <div class="flex items-center gap-2 flex-wrap">
                                <span class="inline-flex items-center px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 text-xs font-medium">
                                    <i class="fas fa-user text-xs mr-1"></i>
                                     ${hiddenFid}
                                </span>
                                <span class="inline-flex items-center px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300 text-xs font-medium">
                                    <i class="fas fa-crown text-xs mr-1"></i>
                                     ${record.kid}
                                </span>
                            </div>
                        </div>

                        <!-- 兑换信息区域 -->
                        <div class="bg-white dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                            <div class="flex flex-col gap-3">
                                <!-- 兑换码行 -->
                                <div class="flex items-center gap-2 flex-1 min-w-0">
                                    <span class="inline-flex items-center px-2 py-1 rounded-full bg-${badgeColorLight}-100 text-${badgeColorLight}-800 dark:bg-${badgeBgDark} dark:text-${badgeColorDark} text-xs font-medium whitespace-nowrap">
                                        <i class="fas fa-gift text-xs mr-1"></i>
                                        兑换
                                    </span>
                                    <code class="text-sm font-mono bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-3 py-1 rounded border border-gray-200 dark:border-gray-700 truncate flex-1">
                                            ${displayCode}
                                    </code>
                                </div>

                                <!-- 时间和自动兑换信息 -->
                                <div class="flex items-center justify-between gap-2">
                                        ${isMultipleCodes || isRepeat ? `
                                        <div class="text-xs text-blue-500 dark:text-blue-400 flex items-center">
                                            <i class="fas fa-info-circle mr-1"></i>
                                            <span>${autoInfo}</span>
                                        </div>` : ''}
                                    <span class="text-xs text-gray-500 dark:text-gray-400 flex items-center space-x-1 whitespace-nowrap">
                                        <i class="far fa-clock text-xs"></i>
                                        <span>${formatTimestamp(record.timestamp)}</span>
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

        exchangeList.appendChild(recordElement);
    });
}


function formatTimestamp(timestampStr) {
    timestampStr = timestampStr.split('.')[0];
    let timestamp = parseFloat(timestampStr);
    if (timestampStr.length === 10) {
        timestamp = timestamp * 1000;
    }

    const date = new Date(timestamp);
    const now = new Date();
    const diffInMs = date - now;
    const isPast = diffInMs <= 0;
    const absDiffInMs = Math.abs(diffInMs);

    const diffInMinutes = Math.floor(absDiffInMs / (1000 * 60));
    const diffInHours = Math.floor(absDiffInMs / (1000 * 60 * 60));

    if (diffInMinutes <= 3) {
        return isPast ? '刚刚' : '即将';
    }

    if (diffInHours < 12) {
        const tsType = isPast ? '前' : '后';
        if (diffInHours < 1) {
            return `${diffInMinutes}分钟${tsType}`;
        }
        return `${diffInHours}小时${tsType}`;
    }

    return new Intl.DateTimeFormat('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(date);
}

function renderRedeemCodes(codes) {
    // 渲染兑换码列表
    if (!codeList) return;
    codeList.innerHTML = '';
    codes.forEach(code => {
        const useEndTime = code.endTime && code.endTime !== '';
        const timeIcon = useEndTime ? 'fas fa-hourglass-end' : 'far fa-clock';
        const codeElement = document.createElement('div');
        codeElement.className = 'p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 transition-colors duration-200 hover:shadow-sm';

        codeElement.innerHTML = `
                <div class="flex justify-between items-start mb-3">
                    <div class="flex items-center space-x-2">
                        <button class="redeem-code font-mono text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors duration-200" data-code="${code.code}">
                            ${code.code}
                        </button>
                        <span class="text-xs px-2 py-1 rounded-full ${code.type === 0 ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-500' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-500'}">
                            ${code.type === 0 ? '<span><i class="fa-solid fa-infinity"></i> 长效</span>' : '<span><i class="fa-solid fa-calendar-days"></i> 限时</span>'}
                        </span>
                    </div>
                    <span class="flex items-center space-x-1 text-sm text-gray-500 dark:text-gray-400">
                            <i class="${timeIcon} text-xs"></i>
                            <span>${formatTimestamp(code.endTime || code.created_at)}</span>
                    </span>
                </div>
                <div class="grid grid-cols-3 gap-2 text-center bg-white dark:bg-gray-900 rounded-lg p-2 border border-gray-200 dark:border-gray-700">
                    <div class="flex flex-col">
                        <span class="font-bold text-gray-900 dark:text-white text-lg">${code.total}</span>
                        <span class="text-xs text-gray-500 dark:text-gray-300">总兑换</span>
                    </div>
                    <div class="flex flex-col">
                        <span class="font-bold text-green-600 dark:text-green-400 text-lg">${code.success}</span>
                        <span class="text-xs text-gray-500 dark:text-gray-300">成功</span>
                    </div>
                    <div class="flex flex-col">
                        <span class="font-bold text-red-600 dark:text-red-400 text-lg">${code.failed}</span>
                        <span class="text-xs text-gray-500 dark:text-gray-300">失败</span>
                    </div>
                </div>
            `;

        codeList.appendChild(codeElement);
    });

    updateCodeCount();

    document.querySelectorAll('.redeem-code').forEach(button => {
        button.addEventListener('click', function () {
            const code = this.getAttribute('data-code');
            copyToClipboard(code);
            showToast('已复制到剪贴板', 'success');
        });
    });
}

function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            return true;
        }).catch(err => {
            return false;
        });
    }
}

async function renderDanmaku() {
    const donationData = await getDanmuAll();
    const allDanmakus = donationData.data;
    if (!allDanmakus || allDanmakus.length === 0) {
        return
    }

    const danmakuContainer = document.querySelector('.danmaku-container .absolute');
    if (!danmakuContainer) return;

    danmakuContainer.innerHTML = '';

    allDanmakus.forEach((donation, index) => {
        const danmakuItem = document.createElement('div');

        // 为每个弹幕计算不同的参数
        const duration = 20 + Math.random() * 15;
        const delay = Math.random() * 10;
        const verticalPos = 20 + Math.random() * 60;

        danmakuItem.className = 'danmaku-item staggered';
        danmakuItem.style.cssText = `
                top: ${verticalPos}px;
                animation: danmaku-scroll-staggered ${duration}s linear ${delay}s infinite;
            `;

        danmakuItem.innerHTML = `
                <div class="relative">
                    <img src="${donation.avatar}" alt="头像" class="danmaku-avatar">
                    <div class="danmaku-info">
                        <div class="danmaku-nickname">${donation.username}</div>
                        <div class="danmaku-amount">¥${donation.amount}</div>
                    </div>
                </div>
            `;

        danmakuItem.addEventListener('mouseenter', function () {
            this.style.animationPlayState = 'paused';
        });

        danmakuItem.addEventListener('mouseleave', function () {
            this.style.animationPlayState = 'running';
        });

        danmakuContainer.appendChild(danmakuItem);
    });
}

class ApiSigner {
    constructor() {
        this.secretKey = new TextEncoder().encode("A6f9!xK8#pL2$mQ7%vB4&nC3*zD1@wE5^");
    }

    async generateSignature(data, post = null) {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        let dataWithTimestamp = {...data};
        if (post) {
            dataWithTimestamp = {...post};
        }
        dataWithTimestamp['timestamp'] = timestamp;

        const sortedData = Object.entries(dataWithTimestamp)
            .sort(([keyA], [keyB]) => keyA.localeCompare(keyB));
        const signStr = sortedData.map(([k, v]) => `${k}=${v}`).join('&');

        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
            'raw',
            this.secretKey,
            {name: 'HMAC', hash: 'SHA-256'},
            false,
            ['sign']
        );

        const signatureBuffer = await crypto.subtle.sign(
            'HMAC',
            key,
            encoder.encode(signStr)
        );

        const signature = Array.from(new Uint8Array(signatureBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        let params = ''
        if (data) {
            params = new URLSearchParams(data).toString() + '&';
        }
        return {
            url: `?${params}signature=${signature}&timestamp=${timestamp}`,
            data: new URLSearchParams(post).toString()
        };
    }
}

function saveImage(imageElement, filename) {
    if (!imageElement) return;

    const link = document.createElement('a');
    link.href = imageElement.src;
    link.download = filename || 'qrcode.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('图片已保存', 'success');
}

if (saveAlipayBtn && alipayQrcode) {
    saveAlipayBtn.addEventListener('click', function () {
        saveImage(alipayQrcode, 'alipay-qrcode.png');
    });
}

if (saveWechatBtn && wechatQrcode) {
    saveWechatBtn.addEventListener('click', function () {
        saveImage(wechatQrcode, 'wechat-qrcode.png');
    });
}

function openRewardModal() {
    if (rewardModal) {
        rewardModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

function closeRewardModal() {
    if (rewardModal) {
        rewardModal.classList.add('hidden');
        document.body.style.overflow = '';
    }
}

if (rewardToggle) {
    rewardToggle.addEventListener('click', openRewardModal);
}

if (rewardClose) {
    rewardClose.addEventListener('click', closeRewardModal);
}

if (rewardModal) {
    rewardModal.addEventListener('click', function (e) {
        if (e.target === rewardModal) {
            closeRewardModal();
        }
    });
}

// 添加兑换码弹窗事件
if (addcodeToggle) {
    addcodeToggle.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        openAddcodeModal();
    });
}

if (addcodeClose) {
    addcodeClose.addEventListener('click', closeAddcodeModal);
}

if (addcodeModal) {
    addcodeModal.addEventListener('click', function (e) {
        if (e.target === addcodeModal) {
            closeAddcodeModal();
        }
    });
}

// 类型选项点击事件
if (typeOptions && typeOptions.length > 0) {
    typeOptions.forEach(option => {
        option.addEventListener('click', function() {
            const type = this.getAttribute('data-type');

            // 更新单选按钮状态
            const radio = this.querySelector('input[type="radio"]');
            if (radio) radio.checked = true;

            // 更新所有选项样式
            typeOptions.forEach(opt => {
                opt.classList.remove('border-blue-500', 'dark:border-blue-400', 'bg-blue-50', 'dark:bg-blue-900/20');
                const checkmark = opt.querySelector('.checkmark');
                if (checkmark) checkmark.classList.remove('opacity-100');
            });

            // 激活当前选项
            this.classList.add('border-blue-500', 'dark:border-blue-400', 'bg-blue-50', 'dark:bg-blue-900/20');
            const currentCheckmark = this.querySelector('.checkmark');
            if (currentCheckmark) currentCheckmark.classList.add('opacity-100');

            // 更新日期字段状态
            updateDateFieldState(type);

            // 重新验证表单
            validateAddcodeForm();
        });
    });
}

// 监听输入变化
if (codeInput) {
    codeInput.addEventListener('input', validateAddcodeForm);
}

if (adminPasswordInput) {
    adminPasswordInput.addEventListener('input', validateAddcodeForm);
}

if (expiryDateInput) {
    expiryDateInput.addEventListener('input', validateAddcodeForm);
    expiryDateInput.addEventListener('change', validateAddcodeForm);

    // 回车键提交
    expiryDateInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter' && submitAddcodeBtn && !submitAddcodeBtn.disabled) {
            submitAddcodeBtn.click();
        }
    });
}

// 兑换码提交函数
if (submitAddcodeBtn) {
    submitAddcodeBtn.addEventListener('click', async function () {
        const code = codeInput ? codeInput.value.trim() : '';
        const password = adminPasswordInput ? adminPasswordInput.value.trim() : '';
        const expiryDate = expiryDateInput ? expiryDateInput.value : '';

        // 获取选中的类型
        let selectedType = '0';
        if (codeTypeRadios && codeTypeRadios.length > 0) {
            codeTypeRadios.forEach(radio => {
                if (radio.checked) {
                    selectedType = radio.value;
                }
            });
        }

        // 最终验证
        if (!code) {
            await showMessage('请输入兑换码', '提示', 'warning');
            if (codeInput) codeInput.focus();
            return;
        }

        if (!password) {
            await showMessage('请输入管理密码', '提示', 'warning');
            if (adminPasswordInput) adminPasswordInput.focus();
            return;
        }

        // 如果是限时兑换，检查日期
        if (selectedType === '1') {
            if (!expiryDate) {
                await showMessage('限时兑换码必须选择有效日期', '提示', 'warning');
                if (expiryDateInput) expiryDateInput.focus();
                return;
            }

            // 检查日期是否有效（不能是过去日期）
            const selectedDate = new Date(expiryDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (selectedDate < today) {
                await showMessage('有效日期不能是过去的时间', '提示', 'warning');
                if (expiryDateInput) expiryDateInput.focus();
                return;
            }
        }

        try {
            const result = await addGiftCode(
                code,
                selectedType,
                selectedType === '1' ? expiryDate : '',
                password
            );

            if (result.code === 0) {
                await showMessage('兑换码添加成功！', '成功', 'success');
                closeAddcodeModal();

                // 刷新兑换码列表
                setTimeout(() => {
                    if (refreshCodes) refreshCodes.click();
                }, 500);
            } else {

                await showMessage(`${result.msg || '未知错误'}`, '失败', 'error');
            }
        } catch (error) {
            await showMessage('添加失败，请检查网络连接', '错误', 'error');
        }
    });
}


if (adminPasswordInput) {
    adminPasswordInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter' && submitAddcodeBtn && !submitAddcodeBtn.disabled) {
            submitAddcodeBtn.click();
        }
    });
}

// 复制联系信息
if (aboutQqCopy) {
    aboutQqCopy.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        copyToClipboard('838210720');
        showToast('QQ号已复制到剪贴板', 'success');
    });
}

if (aboutWechatCopy) {
    aboutWechatCopy.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        copyToClipboard('fanyoubin_8888');
        showToast('微信号已复制到剪贴板', 'success');
    });
}


function closeMessageModal() {
    const innerModal = messageModal.querySelector('.transform');
    // 1. 触发缩小和变透明动画
    messageModal.classList.add('opacity-0');
    if (innerModal) {
        innerModal.classList.remove('scale-100');
        innerModal.classList.add('scale-95');
    }
    // 2. 等待动画结束（300ms）后再彻底隐藏 DOM
    setTimeout(() => {
        messageModal.classList.add('hidden');
    }, 300);
}

const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            const target = mutation.target;
            const innerModal = target.querySelector('.transform');
            if (innerModal) {
                // 当移除 hidden 时，触发显示动画
                if (!target.classList.contains('hidden')) {
                    setTimeout(() => {
                        target.classList.remove('opacity-0');
                        innerModal.classList.remove('scale-95');
                        innerModal.classList.add('scale-100');
                    }, 10);
                }
            }
        }
    });
});

['message-modal', 'reward-modal', 'addcode-modal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) observer.observe(el, { attributes: true, attributeFilter: ['class'] });
});