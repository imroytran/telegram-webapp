// client/src/components/Checkout/CheckoutForm.js - Форма оформления заказа
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../hooks/useAuth';
import { useOrders } from '../../hooks/useOrders';
import { formatPrice } from '../../utils/api';
import { formatPhone, isValidPhone, isValidEmail } from '../../utils/helpers';
import './CheckoutForm.css';

const CheckoutForm = ({ onSuccess }) => {
  const { state } = useAppContext();
  const { cart } = state;
  const { user } = useAuth();
  const { createOrder, loading, error, paymentLink } = useOrders();

  // Состояние формы
  const [formData, setFormData] = useState({
    address: '',
    phone: '',
    email: '',
    deliveryMethod: 'courier',
    paymentMethod: 'online',
    notes: ''
  });
  
  // Состояние валидации
  const [validation, setValidation] = useState({
    address: { valid: true, message: '' },
    phone: { valid: true, message: '' },
    email: { valid: true, message: '' }
  });
  
  // Подставляем данные пользователя при их наличии
  useEffect(() => {
    if (user) {
      const defaultAddress = user.addresses && user.addresses.find(addr => addr.isDefault);
      
      setFormData(prev => ({
        ...prev,
        phone: user.phone || prev.phone,
        email: user.email || prev.email,
        address: defaultAddress 
          ? `${defaultAddress.city}, ${defaultAddress.street}, ${defaultAddress.building}${defaultAddress.apartment ? `, кв. ${defaultAddress.apartment}` : ''}, ${defaultAddress.postalCode}`
          : prev.address
      }));
    }
  }, [user]);
  
  // Обработка изменения полей формы
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Для телефона форматируем значение
    if (name === 'phone') {
      // Удаляем все нецифровые символы
      const digits = value.replace(/\D/g, '');
      
      // Если пользователь стирает, то не форматируем
      if (digits.length <= formData.phone.replace(/\D/g, '').length) {
        setFormData(prev => ({ ...prev, [name]: value }));
        return;
      }
      
      // Форматируем телефон
      const formattedPhone = formatPhone(digits);
      setFormData(prev => ({ ...prev, [name]: formattedPhone }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    
    // Сбрасываем ошибку валидации
    if (validation[name]) {
      setValidation(prev => ({
        ...prev,
        [name]: { valid: true, message: '' }
      }));
    }
  };
  
  // Проверка валидности формы
  const validateForm = () => {
    const newValidation = { ...validation };
    let isValid = true;
    
    // Проверка адреса
    if (!formData.address.trim()) {
      newValidation.address = {
        valid: false,
        message: 'Пожалуйста, укажите адрес доставки'
      };
      isValid = false;
    }
    
    // Проверка телефона
    if (!formData.phone.trim()) {
      newValidation.phone = {
        valid: false,
        message: 'Пожалуйста, укажите контактный телефон'
      };
      isValid = false;
    } else if (!isValidPhone(formData.phone)) {
      newValidation.phone = {
        valid: false,
        message: 'Пожалуйста, укажите корректный телефон'
      };
      isValid = false;
    }
    
    // Проверка email (если указан)
    if (formData.email && !isValidEmail(formData.email)) {
      newValidation.email = {
        valid: false,
        message: 'Пожалуйста, укажите корректный email'
      };
      isValid = false;
    }
    
    setValidation(newValidation);
    return isValid;
  };
  
  // Обработка отправки формы
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Проверяем валидность формы
    if (!validateForm()) {
      return;
    }
    
    // Создаем заказ
    const order = await createOrder(formData);
    
    // Если заказ успешно создан
    if (order) {
      // Вызываем колбэк успешного создания заказа
      if (onSuccess) {
        onSuccess(order, paymentLink);
      }
    }
  };
  
  // Если корзина пуста, не показываем форму
  if (!cart || !cart.items || cart.items.length === 0) {
    return null;
  }
  
  return (
    <div className="checkout-form-container">
      <h2 className="checkout-title">Оформление заказа</h2>
      
      {error && (
        <div className="checkout-error">
          {error}
        </div>
      )}
      
      <form className="checkout-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="address">Адрес доставки*</label>
          <input
            type="text"
            id="address"
            name="address"
            value={formData.address}
            onChange={handleChange}
            placeholder="Город, улица, дом, квартира, индекс"
            className={!validation.address.valid ? 'invalid' : ''}
            required
          />
          {!validation.address.valid && (
            <div className="validation-error">{validation.address.message}</div>
          )}
        </div>
        
        <div className="form-group">
          <label htmlFor="phone">Телефон*</label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder="+7 (___) ___-__-__"
            className={!validation.phone.valid ? 'invalid' : ''}
            required
          />
          {!validation.phone.valid && (
            <div className="validation-error">{validation.phone.message}</div>
          )}
        </div>
        
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="example@mail.ru"
            className={!validation.email.valid ? 'invalid' : ''}
          />
          {!validation.email.valid && (
            <div className="validation-error">{validation.email.message}</div>
          )}
        </div>
        
        <div className="form-group">
          <label htmlFor="deliveryMethod">Способ доставки</label>
          <select
            id="deliveryMethod"
            name="deliveryMethod"
            value={formData.deliveryMethod}
            onChange={handleChange}
          >
            <option value="courier">Курьером</option>
            <option value="pickup">Самовывоз</option>
            <option value="post">Почтой России</option>
          </select>
        </div>
        
        <div className="form-group">
          <label htmlFor="paymentMethod">Способ оплаты</label>
          <select
            id="paymentMethod"
            name="paymentMethod"
            value={formData.paymentMethod}
            onChange={handleChange}
          >
            <option value="online">Онлайн</option>
            <option value="cash">Наличными при получении</option>
            <option value="card_on_delivery">Картой при получении</option>
          </select>
        </div>
        
        <div className="form-group">
          <label htmlFor="notes">Комментарий к заказу</label>
          <textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            placeholder="Дополнительная информация, пожелания"
            rows="3"
          ></textarea>
        </div>
        
        <div className="checkout-summary">
          <div className="checkout-summary-row">
            <span>Товары ({cart.items.length})</span>
            <span>{formatPrice(cart.total)}</span>
          </div>
          
          <div className="checkout-summary-row">
            <span>Доставка</span>
            <span>Бесплатно</span>
          </div>
          
          <div className="checkout-total-row">
            <span>Итого</span>
            <span>{formatPrice(cart.total)}</span>
          </div>
        </div>
        
        <div className="checkout-actions">
          <button 
            type="submit" 
            className="checkout-submit-button"
            disabled={loading}
          >
            {loading ? 'Оформление...' : 'Оформить заказ'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CheckoutForm;
