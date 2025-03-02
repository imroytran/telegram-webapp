// client/src/utils/helpers.js - Вспомогательные функции

// Функция для генерации случайного ID
export const generateId = (length = 8) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
};

// Функция для форматирования текста (обрезка длинного текста)
export const truncateText = (text, maxLength = 100) => {
  if (!text) return '';
  
  if (text.length <= maxLength) {
    return text;
  }
  
  return text.slice(0, maxLength) + '...';
};

// Функция для получения размеров в виде массива или строки
export const formatSizes = (sizes, asString = false) => {
  if (!sizes || !Array.isArray(sizes)) return asString ? '' : [];
  
  if (asString) {
    return sizes.join(', ');
  }
  
  return [...sizes];
};

// Функция для получения цветов в виде массива или строки
export const formatColors = (colors, asString = false) => {
  if (!colors || !Array.isArray(colors)) return asString ? '' : [];
  
  if (asString) {
    return colors.join(', ');
  }
  
  return [...colors];
};

// Функция для форматирования статуса заказа на русском языке
export const formatOrderStatus = (status) => {
  const statuses = {
    'pending': 'Ожидает обработки',
    'processing': 'В обработке',
    'shipped': 'Отправлен',
    'completed': 'Выполнен',
    'cancelled': 'Отменен'
  };
  
  return statuses[status] || status;
};

// Функция для форматирования статуса оплаты на русском языке
export const formatPaymentStatus = (status) => {
  const statuses = {
    'awaiting': 'Ожидает оплаты',
    'paid': 'Оплачен',
    'failed': 'Ошибка оплаты'
  };
  
  return statuses[status] || status;
};

// Функция для форматирования метода доставки на русском языке
export const formatDeliveryMethod = (method) => {
  const methods = {
    'courier': 'Курьером',
    'pickup': 'Самовывоз',
    'post': 'Почтой России'
  };
  
  return methods[method] || method;
};

// Функция для форматирования метода оплаты на русском языке
export const formatPaymentMethod = (method) => {
  const methods = {
    'online': 'Онлайн',
    'cash': 'Наличными при получении',
    'card_on_delivery': 'Картой при получении'
  };
  
  return methods[method] || method;
};

// Функция для получения цвета по статусу заказа (для стилизации)
export const getStatusColor = (status) => {
  const colors = {
    'pending': '#ffc107', // Желтый
    'processing': '#17a2b8', // Синий
    'shipped': '#007bff', // Голубой
    'completed': '#28a745', // Зеленый
    'cancelled': '#dc3545' // Красный
  };
  
  return colors[status] || '#6c757d'; // Серый по умолчанию
};

// Функция для получения цвета по статусу оплаты (для стилизации)
export const getPaymentStatusColor = (status) => {
  const colors = {
    'awaiting': '#ffc107', // Желтый
    'paid': '#28a745', // Зеленый
    'failed': '#dc3545' // Красный
  };
  
  return colors[status] || '#6c757d'; // Серый по умолчанию
};

// Функция для преобразования строки в camelCase
export const toCamelCase = (str) => {
  return str
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]+(.)/g, (m, chr) => chr.toUpperCase());
};

// Функция для проверки валидности email
export const isValidEmail = (email) => {
  const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
};

// Функция для проверки валидности телефона
export const isValidPhone = (phone) => {
  const re = /^(\+7|7|8)?[\s\-]?\(?[489][0-9]{2}\)?[\s\-]?[0-9]{3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{2}$/;
  return re.test(String(phone));
};

// Функция для форматирования телефона в российском формате
export const formatPhone = (phone) => {
  if (!phone) return '';
  
  // Удаляем все нецифровые символы
  const digits = phone.replace(/\D/g, '');
  
  // Проверяем, что получилось 10 или 11 цифр
  if (digits.length < 10 || digits.length > 11) {
    return phone; // Возвращаем исходный телефон, если не подходит под формат
  }
  
  // Если начинается с 8 или 7, то это российский номер
  let formattedPhone = '';
  
  if (digits.length === 11) {
    formattedPhone = `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
  } else {
    formattedPhone = `+7 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 8)}-${digits.slice(8, 10)}`;
  }
  
  return formattedPhone;
};

// Функция для получения списка размеров одежды
export const getClothingSizes = () => {
  return ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '36', '38', '40', '42', '44', '46', '48', '50', '52', '54', '56', '58'];
};

// Функция для получения списка основных цветов
export const getBasicColors = () => {
  return [
    'Черный', 'Белый', 'Серый', 'Красный', 'Синий', 'Зеленый', 
    'Желтый', 'Оранжевый', 'Розовый', 'Фиолетовый', 'Коричневый', 
    'Бежевый', 'Голубой', 'Серебряный', 'Золотой'
  ];
};

// Функция для форматирования ошибки с сервера для отображения пользователю
export const formatErrorMessage = (error) => {
  if (!error) return 'Произошла неизвестная ошибка';
  
  if (typeof error === 'string') return error;
  
  if (error.response && error.response.data) {
    if (error.response.data.error) {
      return error.response.data.error;
    }
    
    if (error.response.data.message) {
      return error.response.data.message;
    }
  }
  
  if (error.message) {
    return error.message;
  }
  
  return 'Произошла ошибка при обработке запроса';
};

// Функция для преобразования первой буквы строки в верхний регистр
export const capitalizeFirstLetter = (string) => {
  if (!string) return '';
  return string.charAt(0).toUpperCase() + string.slice(1);
};

// Функция для сортировки массива объектов по полю
export const sortArrayByField = (arr, field, order = 'asc') => {
  if (!arr || !Array.isArray(arr)) return [];
  
  return [...arr].sort((a, b) => {
    const valA = a[field];
    const valB = b[field];
    
    if (valA === undefined || valB === undefined) {
      return 0;
    }
    
    // Сортировка строк
    if (typeof valA === 'string' && typeof valB === 'string') {
      return order === 'asc' 
        ? valA.localeCompare(valB) 
        : valB.localeCompare(valA);
    }
    
    // Сортировка чисел и дат
    return order === 'asc' ? valA - valB : valB - valA;
  });
};

// Функция для фильтрации массива объектов по значению поля
export const filterArrayByField = (arr, field, value) => {
  if (!arr || !Array.isArray(arr)) return [];
  if (!value) return arr;
  
  return arr.filter(item => {
    const fieldValue = item[field];
    
    if (fieldValue === undefined) return false;
    
    // Если значение - строка, ищем подстроку
    if (typeof fieldValue === 'string') {
      return fieldValue.toLowerCase().includes(value.toLowerCase());
    }
    
    // Если значение - число или булево, проверяем на равенство
    return fieldValue === value;
  });
};

// Функция для группировки массива объектов по полю
export const groupArrayByField = (arr, field) => {
  if (!arr || !Array.isArray(arr)) return {};
  
  return arr.reduce((acc, item) => {
    const key = item[field];
    
    if (key === undefined) return acc;
    
    if (!acc[key]) {
      acc[key] = [];
    }
    
    acc[key].push(item);
    return acc;
  }, {});
};
