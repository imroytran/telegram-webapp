// client/src/hooks/useTelegram.js - Хук для работы с Telegram
import { useEffect, useState } from 'react';

export const useTelegram = () => {
  const [tg, setTg] = useState(null);
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Получаем объект Telegram WebApp
    const telegram = window.Telegram?.WebApp;

    if (telegram) {
      // Активируем приложение
      telegram.ready();
      setReady(true);
      setTg(telegram);

      // Извлекаем данные пользователя из строки инициализации
      try {
        if (telegram.initDataUnsafe?.user) {
          setUser(telegram.initDataUnsafe.user);
        }
      } catch (error) {
        console.error('Error parsing Telegram user data:', error);
      }
    } else {
      console.warn('Telegram WebApp is not available');
    }
  }, []);

  const onClose = () => {
    tg?.close();
  };

  const onBack = () => {
    tg?.BackButton.onClick(() => {
      // Обработка нажатия кнопки "Назад"
    });
  };

  const showMainButton = (text, onClick) => {
    if (!tg) return;

    tg.MainButton.text = text;
    tg.MainButton.show();
    tg.MainButton.onClick(onClick);
  };

  const hideMainButton = () => {
    tg?.MainButton.hide();
  };

  const showPopup = (options) => {
    if (!tg) return Promise.reject('Telegram WebApp is not available');

    return new Promise((resolve) => {
      tg.showPopup(options, resolve);
    });
  };

  const showAlert = (message) => {
    if (!tg) return Promise.reject('Telegram WebApp is not available');

    return new Promise((resolve) => {
      tg.showAlert(message, resolve);
    });
  };

  const showConfirm = (message) => {
    if (!tg) return Promise.reject('Telegram WebApp is not available');

    return new Promise((resolve) => {
      tg.showConfirm(message, resolve);
    });
  };

  const adaptTheme = () => {
    if (!tg) return {};

    // Преобразуем тему Telegram в CSS переменные
    const theme = {
      backgroundColor: tg.backgroundColor,
      textColor: tg.textColor,
      buttonColor: tg.buttonColor,
      buttonTextColor: tg.buttonTextColor,
      isDarkMode: tg.colorScheme === 'dark'
    };

    // Применяем тему к корневому элементу
    document.documentElement.style.setProperty('--tg-background-color', theme.backgroundColor);
    document.documentElement.style.setProperty('--tg-text-color', theme.textColor);
    document.documentElement.style.setProperty('--tg-button-color', theme.buttonColor);
    document.documentElement.style.setProperty('--tg-button-text-color', theme.buttonTextColor);

    // Добавляем класс темы к body
    if (theme.isDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }

    return theme;
  };

  useEffect(() => {
    if (tg) {
      adaptTheme();

      // Обработчик изменения темы
      const themeChangeCallback = () => {
        adaptTheme();
      };

      tg.onEvent('themeChanged', themeChangeCallback);

      return () => {
        tg.offEvent('themeChanged', themeChangeCallback);
      };
    }
  }, [tg]);

  return {
    tg,
    user,
    ready,
    onClose,
    onBack,
    showMainButton,
    hideMainButton,
    showPopup,
    showAlert,
    showConfirm,
    adaptTheme
  };
};
