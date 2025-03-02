// client/src/components/Cart/CartItem.js - Компонент элемента корзины
import React from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import { formatPrice } from '../../utils/api';
import './CartItem.css';

const CartItem = ({ item, index }) => {
  const { actions } = useAppContext();
  
  // Проверяем наличие товара
  if (!item || !item.product) return null;
  
  const { product, quantity, size, color, price } = item;
  
  // Выбираем основное изображение товара (первое или дефолтное)
  const mainImage = product.imageUrl || 
    (product.images && product.images.length > 0
      ? product.images[0]
      : 'https://via.placeholder.com/80x80?text=No+Image');
  
  // Обработчик изменения количества товара
  const handleQuantityChange = (newQuantity) => {
    if (newQuantity < 1) return;
    if (newQuantity > 10) return; // Максимальное количество - 10 штук
    
    actions.updateCartItem(index, newQuantity);
  };
  
  // Обработчик удаления товара из корзины
  const handleRemove = () => {
    actions.removeCartItem(index);
  };
  
  return (
    <div className="cart-item">
      <div className="cart-item-image">
        <Link to={`/product/${product._id}`}>
          <img src={mainImage} alt={product.title} loading="lazy" />
        </Link>
      </div>
      
      <div className="cart-item-details">
        <Link to={`/product/${product._id}`} className="cart-item-title">
          {product.title}
        </Link>
        
        <div className="cart-item-attributes">
          {size && <span className="cart-item-size">Размер: {size}</span>}
          {color && <span className="cart-item-color">Цвет: {color}</span>}
        </div>
        
        <div className="cart-item-price-mobile">
          {formatPrice(price)} × {quantity} = {formatPrice(price * quantity)}
        </div>
        
        <div className="cart-item-actions">
          <div className="quantity-control">
            <button 
              className="quantity-button minus"
              onClick={() => handleQuantityChange(quantity - 1)}
              disabled={quantity <= 1}
            >
              -
            </button>
            <span className="quantity-value">{quantity}</span>
            <button 
              className="quantity-button plus"
              onClick={() => handleQuantityChange(quantity + 1)}
              disabled={quantity >= 10}
            >
              +
            </button>
          </div>
          
          <button 
            className="remove-button"
            onClick={handleRemove}
            aria-label="Удалить товар"
          >
            <i className="remove-icon"></i>
          </button>
        </div>
      </div>
      
      <div className="cart-item-price">
        <div className="item-price">{formatPrice(price)}</div>
        <div className="item-quantity">× {quantity}</div>
      </div>
      
      <div className="cart-item-total">
        {formatPrice(price * quantity)}
      </div>
    </div>
  );
};

export default CartItem;