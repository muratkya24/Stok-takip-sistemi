import React, { createContext, useState, useContext, useMemo } from 'react';

// 1. Context'i oluşturuyoruz.
const SepetContext = createContext();

// 2. Bu context'i diğer bileşenlerde kolayca kullanmak için bir hook oluşturuyoruz.
export function useSepet() {
  return useContext(SepetContext);
}

// 3. Provider bileşenimiz: Bu, uygulamayı saracak ve sepet verilerini sağlayacak.
export function SepetProvider({ children, showModal }) {
  const [basket, setBasket] = useState([]);

  // Ürünü sepete ekleme veya miktarını artırma mantığı
  const addProductToBasket = (product) => {
    if (product.stokadedi <= 0) {
      showModal('Stok Yetersiz', `"${product.isim}" adlı ürünün stoğu tükenmiştir.`);
      return;
    }
    const existingItemIndex = basket.findIndex(item => item.id === product.id);
    if (existingItemIndex > -1) {
      const newBasket = [...basket];
      const existingItem = newBasket[existingItemIndex];
      if (existingItem.quantity < product.stokadedi) {
        existingItem.quantity += 1;
        setBasket(newBasket);
      } else {
        showModal('Stok Limiti', `Sepete ekleyebileceğiniz maksimum "${product.isim}" adedine ulaştınız.`);
      }
    } else {
      setBasket([...basket, { ...product, quantity: 1 }]);
    }
  };

  // Sepetteki ürünün miktarını güncelleme mantığı
  const updateQuantity = (productId, amount) => {
    const newBasket = basket.map(item => {
      if (item.id === productId) {
        const newQuantity = item.quantity + amount;
        if (newQuantity > 0 && newQuantity <= item.stokadedi) {
          return { ...item, quantity: newQuantity };
        } else if (newQuantity > item.stokadedi) {
          showModal('Stok Limiti', `Maksimum stok adedine ulaştınız: ${item.stokadedi}`);
          return item;
        }
      }
      return item;
    }).filter(item => item.quantity > 0); // Miktarı 0'a düşenleri sepetten çıkar
    setBasket(newBasket);
  };

  // Ürünü sepetten tamamen kaldırma mantığı
  const removeFromBasket = (productId) => {
    setBasket(basket.filter(item => item.id !== productId));
  };

  // Sepeti tamamen temizleme mantığı
  const clearBasket = () => {
    setBasket([]);
  };

  // Toplam tutarı hesaplama
  const totalAmount = useMemo(() => {
    return basket.reduce((total, item) => total + (item.satisfiyati * item.quantity), 0);
  }, [basket]);

  // Bu değerleri ve fonksiyonları Provider aracılığıyla alt bileşenlere aktaracağız.
  const value = {
    basket,
    addProductToBasket,
    updateQuantity,
    removeFromBasket,
    clearBasket,
    totalAmount,
  };

  return (
    <SepetContext.Provider value={value}>
      {children}
    </SepetContext.Provider>
  );
}
