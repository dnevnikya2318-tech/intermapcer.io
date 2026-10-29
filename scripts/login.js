const container = document.getElementById('container');
const registerBtn = document.getElementById('register');
const loginBtn = document.getElementById('login');
const verificationForm = document.getElementById('verificationForm');
const verificationInput = document.getElementById('verificationInput');
const registerForm = document.getElementById('registerForm');

let currEmail = null;
let configResponse = null;
let config = null;
let apiBaseUrl = null;


document.addEventListener('DOMContentLoaded', async () => {
    configResponse = await fetch('../config.json');
    config = await configResponse.json();
    apiBaseUrl = config.API_BASE_URL;
});

registerBtn.addEventListener('click', () => {
    container.classList.add("active");
});

loginBtn.addEventListener('click', () => {
    container.classList.remove("active");
});

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const emailLogin = document.getElementById('emailLogin').value;
    const passwordLogin = document.getElementById('passwordLogin').value;
    const messageElement = document.getElementById('messageLogin');

    try {
        const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'bypass-tunnel-reminder': 'true',
                'tuna-skip-browser-warning': 'true'
             },
            body: JSON.stringify({ email: emailLogin, password: passwordLogin})
        });

        if (!response.ok){
            throw new Error('Invalid credentials');
        }

        const data = await response.json();

        // Сохранение токена в локальное хранилище
        localStorage.setItem('authToken', data.token);

        messageElement.style.color = 'green';
        messageElement.innerText = 'Login successful!';

        window.location.href = '../';
    } catch (error) {
        messageElement.innerText = error.message;
    }
});

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const usernameInput = document.getElementById('usernameRegister').value.trim();
    const emailInput = document.getElementById('emailRegister').value;
    const passwordInput = document.getElementById('passwordRegister').value;
    const confirmPasswordInput = document.getElementById('confirmPassword').value;
    const messageElement = document.getElementById('messageRegister');

    // Первичная проверка совпадения паролей на клиенте
    if (passwordInput !== confirmPasswordInput) {
        messageElement.innerText = 'Passwords do not match!';
        return;
    }

    try {
        // Отправка запроса на бэкенд
        const response = await fetch(`${apiBaseUrl}/api/auth/register`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'bypass-tunnel-reminder': 'true',
                'tuna-skip-browser-warning': 'true'
             },
            body: JSON.stringify({
                username: usernameInput,
                email: emailInput,
                password: passwordInput
            })
        });

        // Обработка ответа
        if (!response.ok) {
            // Если бэкенд вернул ошибку, читаем текст ошибки
            const errorText = await response.text();
            throw new Error(errorText || 'Registration error occured.');
        }

        const data = await response.json();

        // Успешная регистрация
        messageElement.style.color = 'green';
        messageElement.innerText = data.message || 'Successful registration!';

        // Сохраняем e-mail для метода верификации
        currEmail = emailInput;

        // Очищаем форму
        document.getElementById('registerForm').reset();

        registerForm.style.display = 'none'
        verificationForm.style.display = 'flex';
        

    } catch (error) {
        // Выводим ошибку, которую прислал сервер
        messageElement.innerText = error.message;
    }
});

verificationForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const response = await fetch(`${apiBaseUrl}/api/auth/verify-code`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'bypass-tunnel-reminder': 'true',
                'tuna-skip-browser-warning': 'true'
            },
            body: JSON.stringify({ email: currEmail, code: verificationInput.value })
        });

        const data = await response.json();

        if (response.ok) {
            alert(data.message);
            localStorage.setItem('authToken', data.token);
            window.location.href = '../';
        } else {
            alert(data.message);
            verificationForm.reset();
        }
    } catch (error) {
        console.error('Verification error:', error);
    }
});