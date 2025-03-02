// client/src/components/Product/ProductCard.js - Компонент карточки товара
import React from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import { formatPrice } from '../../utils/api';
import './ProductCard.css';

const ProductCard = ({ product }) => {
  const { actions } = useAppContext();
  
  // Проверяем наличие товара
  if (!product) return null;
  
  // Получаем данные товара
  const { 
    _id, 
    title, 
    category, 
    price, 
    discount, 
    imageUrls = [], 
    sizes = [],
    colors = [],
    inStock = true
  } = product;
  
  // Вычисляем цену со скидкой
  const finalPrice = discount ? price - (price * (discount / 100)) : price;
  
  // Выбираем основное изображение товара (первое или дефолтное)
  const mainImage = imageUrls.length > 0 
    ? imageUrls[0] 
    : 'https://via.placeholder.com/300x400?text=No+Image';
  
  // Обработчик добавления товара в корзину
  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!inStock) return;
    
    // Если у товара есть размеры и цвета, то нужно перейти на страницу товара
    // для выбора конкретных параметров
    if (sizes.length > 0 && colors.length > 0) {
      // Показываем уведомление о необходимости выбора параметров
      actions.showNotification('Пожалуйста, выберите размер и цвет', 'info');
      return;
    }
    
    // Если размеров и цветов нет или только одно значение, можем добавить товар сразу
    const size = sizes.length === 1 ? sizes[0] : 'Универсальный';
    const color = colors.length === 1 ? colors[0] : 'Универсальный';
    
    // Добавляем товар в корзину
    actions.addToCart(_id, size, color, 1);
  };
  
  return (
    <div className="product-card">
      <Link to={`/product/${_id}`} className="product-link">
        <div className="product-image-container">
          <img 
            src={mainImage} 
            alt={title} 
            className="product-image" 
            loading="lazy"
          />
          
          {/* Бейджи для скидки и наличия */}
          {discount > 0 && (
            <span className="product-badge discount">-{discount}%</span>
          )}
          
          {!inStock && (
            <span className="product-badge out-of-stock">Нет в наличии</span>
          )}
        </div>
        
        <div className="product-info">
          <div className="product-category">{category}</div>
          <h3 className="product-title">{title}</h3>
          
          <div className="product-price-container">
            {discount > 0 ? (
              <>
                <span className="product-price discounted">
                  {formatPrice(finalPrice)}
                </span>
                <span className="product-old-price">
                  {formatPrice(price)}
                </span>
              </>
            ) : (
              <span className="product-price">{formatPrice(price)}</span>
            )}
          </div>
          
          {/* Доступные размеры и цвета */}
          {sizes.length > 0 && (
            <div className="product-sizes">
              {sizes.length > 3 ? (
                `${sizes.slice(0, 3).join(', ')} +${sizes.length - 3}`
              ) : (
                sizes.join(', ')
              )}
            </div>
          )}
          
          {colors.length > 0 && (
            <div className="product-colors">
              {colors.length > 2 ? (
                `${colors.slice(0, 2).join(', ')} +${colors.length - 2}`
              ) : (
                colors.join(', ')
              )}
            </div>
          )}
        </div>
      </Link>
      
      {/* Кнопка добавления в корзину */}
      <button 
        className={`add-to-cart-button ${!inStock ? 'disabled' : ''}`}
        onClick={handleAddToCart}
        disabled={!inStock}
      >
        {inStock ? 'В корзину' : 'Нет в наличии'}
      </button>
    </div>
  );
};

export default ProductCard;
