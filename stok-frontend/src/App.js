// app.js (Giriş Sistemi Entegre Edilmiş Hali)

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import './App.css';

// YENİ: AuthContext ve Login bileşenini import et
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';

// Diğer Context'ler
import { SepetProvider, useSepet } from './contexts/SepetContext';
import { ProductProvider, useProduct } from './contexts/ProductContext';
import { ReportProvider, useReport } from './contexts/ReportContext';

// --- İKONLAR ---
const EditIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="icon"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12.572l-4.5-4.5" /></svg>);
const DeleteIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="icon"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.134-2.09-2.134H8.09c-1.18 0-2.09.954-2.09 2.134v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>);
const ReturnIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="icon"><path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg>);
const PlusIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="icon-small"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>);
const MinusIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="icon-small"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" /></svg>);
const LogoutIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="icon"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>);


// --- MODAL BİLEŞENİ ---
function Modal({ isOpen, onClose, onConfirm, title, children, size = 'md' }) {
    if (!isOpen) return null;
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className={`modal-content modal-${size}`} onClick={e => e.stopPropagation()}>
                <h2 className="modal-title">{title}</h2>
                <div className="modal-body">{children}</div>
                <div className="modal-actions">
                    <button onClick={onConfirm ? onConfirm : onClose} className={`button ${onConfirm ? 'danger-button' : 'primary-button'}`}>{onConfirm ? 'Onayla' : 'Tamam'}</button>
                    {onConfirm && (<button onClick={onClose} className="button secondary-button">Vazgeç</button>)}
                </div>
            </div>
        </div>
    );
}

// --- Diğer Bileşenler (Değişiklik yok) ---
function GroupedProductRow({ productGroup, selection, onSelectionChange, onEdit, onDelete }) {
    const { gender, color, size } = selection || {};
    const [selectedVariant, setSelectedVariant] = useState(null);
    const availableGenders = useMemo(() => [...new Set(productGroup.varyasyonlar.map(v => v.cinsiyet).filter(Boolean))], [productGroup]);
    const availableColors = useMemo(() => {if (!gender) return [];return [...new Set(productGroup.varyasyonlar.filter(v => v.cinsiyet === gender).map(v => v.renk).filter(Boolean))];}, [gender, productGroup]);
    const availableSizes = useMemo(() => {if (!gender || !color) return [];return [...new Set(productGroup.varyasyonlar.filter(v => v.cinsiyet === gender && v.renk === color).map(v => v.beden).filter(Boolean))];}, [gender, color, productGroup]);
    useEffect(() => {if (gender && color && size) {const variant = productGroup.varyasyonlar.find(v => v.cinsiyet === gender && v.renk === color && v.beden === size);setSelectedVariant(variant || null);} else {setSelectedVariant(null);}}, [gender, color, size, productGroup.varyasyonlar]);
    const displayedStock = useMemo(() => {let variantsToSum = productGroup.varyasyonlar;if (gender) { variantsToSum = variantsToSum.filter(v => v.cinsiyet === gender); }if (color) { variantsToSum = variantsToSum.filter(v => v.renk === color); }if (size) { variantsToSum = variantsToSum.filter(v => v.beden === size); }return variantsToSum.reduce((total, variant) => total + (variant.stokadedi || 0), 0);}, [gender, color, size, productGroup.varyasyonlar]);
    return (<tr className={selectedVariant && selectedVariant.stokadedi <= 0 ? 'out-of-stock' : ''}><td>{productGroup.urun_ismi}</td><td><select value={gender || ''} onChange={(e) => onSelectionChange(productGroup.urun_ismi, 'gender', e.target.value)} className="form-input-small"><option value="">Cinsiyet</option>{availableGenders.map(g => <option key={g} value={g}>{g}</option>)}</select></td><td><select value={color || ''} onChange={(e) => onSelectionChange(productGroup.urun_ismi, 'color', e.target.value)} disabled={!gender} className="form-input-small"><option value="">Renk</option>{availableColors.map(c => <option key={c} value={c}>{c}</option>)}</select></td><td><select value={size || ''} onChange={(e) => onSelectionChange(productGroup.urun_ismi, 'size', e.target.value)} disabled={!color} className="form-input-small"><option value="">Beden</option>{availableSizes.map(s => <option key={s} value={s}>{s}</option>)}</select></td><td>{selectedVariant ? selectedVariant.barcode : '-'}</td><td>{displayedStock}</td><td>{selectedVariant && selectedVariant.alisfiyati ? `${parseFloat(selectedVariant.alisfiyati).toFixed(2)} ₺` : '-'}</td><td>{selectedVariant ? `${parseFloat(selectedVariant.satisfiyati).toFixed(2)} ₺` : '-'}</td><td className="actions-cell">{selectedVariant && (<><button onClick={() => onEdit(selectedVariant)} className="icon-button edit-button" title="Düzenle"><EditIcon /></button><button onClick={() => onDelete(selectedVariant.id, selectedVariant.isim)} className="icon-button delete-button" title="Sil"><DeleteIcon /></button></>)}</td></tr>);
}
function SalesTerminal({ showModal }) {
    const { basket, addProductToBasket, updateQuantity, removeFromBasket, clearBasket, totalAmount } = useSepet();
    const [barcodeInput, setBarcodeInput] = useState('');
    const handleBarcodeScan = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (!barcodeInput) return;
            axios.get(`https://muratkya244.pythonanywhere.com/api/products/by-barcode/${barcodeInput}`)
                .then(res => { addProductToBasket(res.data); setBarcodeInput(''); })
                .catch(err => { showModal('Hata', `Bu barkoda sahip bir ürün bulunamadı: ${barcodeInput}`); });
        }
    };
    const handleCompleteSale = () => {
        if (basket.length === 0) { showModal('Uyarı', 'Satışı tamamlamak için önce sepete ürün eklemelisiniz.'); return; }
        const saleData = { basket: basket.map(item => ({ id: item.id, quantity: item.quantity, isim: item.isim })) };
        showModal('Satışı Onayla', 'Sepetteki ürünlerin satışını tamamlamak istediğinizden emin misiniz?',
        () => {
            axios.post('https://muratkya244.pythonanywhere.com/api/sales/bulk', saleData)
                .then(res => { showModal('Başarılı', res.data.mesaj); clearBasket(); })
                .catch(err => { showModal('Hata', `Satış tamamlanamadı: ${err.response?.data?.hata || 'Bilinmeyen bir hata oluştu.'}`); });
        });
    };
    return ( <div className="pos-container"> <div className="pos-basket-panel card"> <h2 className="pos-title">Satış Sepeti</h2> <div className="basket-items"> {basket.length === 0 ? (<p className="info-text">Sepetiniz boş.</p>) : ( basket.map(item => ( <div key={item.id} className="basket-item"> <div className="item-info"> <span className="item-name">{item.isim} ({item.renk}, {item.beden})</span> <span className="item-price">{item.quantity} x {parseFloat(item.satisfiyati).toFixed(2)} ₺</span> </div> <div className="item-actions"> <button onClick={() => updateQuantity(item.id, -1)} className="quantity-btn"><MinusIcon /></button> <span className="item-quantity">{item.quantity}</span> <button onClick={() => updateQuantity(item.id, 1)} className="quantity-btn"><PlusIcon /></button> <button onClick={() => removeFromBasket(item.id)} className="delete-btn-small"><DeleteIcon /></button> </div> </div> )) )} </div> <div className="basket-summary"> <div className="total-amount"> <span>Toplam Tutar:</span> <span>{totalAmount.toFixed(2)} ₺</span> </div> <button onClick={handleCompleteSale} className="button primary-button complete-sale-btn" disabled={basket.length === 0}>Satışı Tamamla</button> </div> </div> <div className="pos-product-panel"> <div className="card search-container"> <input type="text" className="form-input" placeholder="Barkodu Okutun veya Manuel Girin..." value={barcodeInput} onChange={(e) => setBarcodeInput(e.target.value)} onKeyDown={handleBarcodeScan} autoFocus /> </div> </div> </div> );
}
function ProductManagement() {
    const { loading, formData, editingProductId, searchTerm, setSearchTerm, selections, handleSelectionChange, handleInputChange, handleClearForm, handleCancelEdit, handleEditClick, handleSubmit, handleGenerateBarcode, handleDelete, filteredGroupedProducts } = useProduct();
    return ( <> <div className={`card form-container ${editingProductId ? 'edit-mode' : ''}`}> <h2 className="form-title">{editingProductId ? `Ürünü Düzenle (ID: ${editingProductId})` : 'Yeni Ürün Ekle'}</h2> <form onSubmit={handleSubmit} className="product-form"> <div className="form-field"><label htmlFor="isim">Ürün İsmi</label><input id="isim" name="isim" className="form-input" value={formData.isim} onChange={handleInputChange} placeholder="Örn: V Yaka Tişört" required /></div> <div className="form-field"><label htmlFor="satisfiyati">Satış Fiyatı (₺)</label><input id="satisfiyati" name="satisfiyati" className="form-input" value={formData.satisfiyati} onChange={handleInputChange} type="number" step="0.01" placeholder="Örn: 299.90" required /></div> <div className="form-field full-width"><label htmlFor="barcode">Barkod</label><div className="form-group"><input id="barcode" name="barcode" className="form-input" value={formData.barcode} onChange={handleInputChange} /><button type="button" onClick={handleGenerateBarcode} className="button secondary-button">Barkod Oluştur</button></div></div> <div className="form-field"><label htmlFor="stokadedi">Stok Adedi</label><input id="stokadedi" name="stokadedi" className="form-input" value={formData.stokadedi} onChange={handleInputChange} type="number" placeholder="Örn: 50" /></div> <div className="form-field"><label htmlFor="alisfiyati">Alış Fiyatı (₺)</label><input id="alisfiyati" name="alisfiyati" className="form-input" value={formData.alisfiyati} onChange={handleInputChange} type="number" step="0.01" placeholder="Örn: 150.00"/></div> <div className="form-field"><label htmlFor="renk">Renk</label><input id="renk" name="renk" className="form-input" value={formData.renk} onChange={handleInputChange} placeholder="Örn: Siyah"/></div> <div className="form-field"><label htmlFor="beden">Beden</label><input id="beden" name="beden" className="form-input" value={formData.beden} onChange={handleInputChange} placeholder="Örn: M" /></div> <div className="form-field full-width"><label htmlFor="cinsiyet">Cinsiyet</label><select id="cinsiyet" name="cinsiyet" className="form-input" value={formData.cinsiyet} onChange={handleInputChange}><option value="">Cinsiyet Seçin...</option><option value="Kadın">Kadın</option><option value="Erkek">Erkek</option><option value="Unisex">Unisex</option></select></div> <div className="form-buttons full-width">{!editingProductId && <button type="button" onClick={handleClearForm} className="button secondary-button">Formu Temizle</button>}{editingProductId && <button type="button" onClick={handleCancelEdit} className="button secondary-button">İptal</button>}<button type="submit" className="button primary-button">{editingProductId ? 'Değişiklikleri Kaydet' : 'Yeni Ürün Ekle'}</button></div> </form> </div> <div className="card product-table-container"> <div className="table-header"><h2 className="table-title">Stok Listesi (Gruplanmış)</h2><input type="text" className="form-input table-search-input" placeholder="Ürün Adı veya Barkod Ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/></div> {loading ? <p className="info-text">Yükleniyor...</p> : ( <table className="product-table grouped-table"> <thead><tr><th>Ürün İsmi</th><th>Cinsiyet</th><th>Renk</th><th>Beden</th><th>Barkod</th><th>Stok</th><th>Alış Fiyatı</th><th>Satış Fiyatı</th><th className="actions-cell">İşlemler</th></tr></thead> <tbody>{filteredGroupedProducts.map(group => (<GroupedProductRow key={group.urun_ismi} productGroup={group} selection={selections[group.urun_ismi]} onSelectionChange={handleSelectionChange} onEdit={handleEditClick} onDelete={handleDelete}/>))}</tbody> </table> )} </div></> );
}
function SalesReport({ showModal }) {
    const { groupedSales, loading, selectedDate, setSelectedDate, handleReturn, totalRevenue, totalProfit } = useReport();
    const [detailsModal, setDetailsModal] = useState({ isOpen: false, transaction: null });
    const [returnModal, setReturnModal] = useState({ isOpen: false, sale: null, quantity: 1 });
    const openReturnModal = (sale) => { setReturnModal({ isOpen: true, sale: sale, quantity: sale.adet }); };
    const closeReturnModal = () => { setReturnModal({ isOpen: false, sale: null, quantity: 1 }); };
    const confirmReturn = () => {
        const quantity = parseInt(returnModal.quantity, 10);
        if (isNaN(quantity) || quantity < 1 || quantity > returnModal.sale.adet) { showModal('Geçersiz Adet', `Lütfen iade edilecek adet için 1 ile ${returnModal.sale.adet} arasında bir sayı girin.`); return; }
        handleReturn(returnModal.sale.id, quantity, () => { closeReturnModal(); setDetailsModal({ isOpen: false, transaction: null }); });
    };
    return ( <div className="sales-report-container"> <h1 className="page-title">Satış Raporları</h1> <div className="card report-controls"> <div className="date-filter-container"><label htmlFor="sales-date">Rapor Tarihi:</label><input type="date" id="sales-date" className="form-input" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} /></div> <div className="report-summary"> <div className="summary-card"><h3>Toplam İşlem</h3><span>{groupedSales.length} adet</span></div> <div className="summary-card"><h3>Günlük Ciro</h3><span>{totalRevenue.toFixed(2)} ₺</span></div> <div className="summary-card profit"><h3>Günlük Kâr</h3><span>{totalProfit.toFixed(2)} ₺</span></div> </div> </div> <div className="card product-table-container"> {loading ? <p className="info-text">Rapor Yükleniyor...</p> : ( <table className="product-table"> <thead> <tr><th>İşlem Zamanı</th><th>Ürün Sayısı</th><th>Toplam Tutar</th><th className="actions-cell">Detaylar</th></tr> </thead> <tbody> {groupedSales.length > 0 ? groupedSales.map(transaction => ( <tr key={transaction.id}> <td>{new Date(transaction.timestamp).toLocaleString('tr-TR')}</td> <td>{transaction.totalItems} adet</td> <td>{transaction.totalAmount.toFixed(2)} ₺</td> <td className="actions-cell"> <button onClick={() => setDetailsModal({ isOpen: true, transaction: transaction.items })} className="button secondary-button" style={{padding: '0.5rem 1rem'}}>Detayları Gör</button> </td> </tr> )) : (<tr><td colSpan="4" className="info-text" style={{padding: '2rem'}}>Seçilen tarihte satış bulunmamaktadır.</td></tr>)} </tbody> </table> )} </div> {detailsModal.isOpen && ( <Modal isOpen={detailsModal.isOpen} onClose={() => setDetailsModal({ isOpen: false, transaction: null })} title={`İşlem Detayları (${new Date(detailsModal.transaction[0].satis_tarihi).toLocaleString('tr-TR')})`} size="lg"> <table className="product-table"> <thead><tr><th>Ürün İsmi</th><th>Barkod</th><th>Adet</th><th>Birim Fiyat</th><th>Toplam</th><th className="actions-cell">İade</th></tr></thead> <tbody> {detailsModal.transaction.map(sale => ( <tr key={sale.id}> <td>{`${sale.urun_ismi} (${sale.cinsiyet || 'N/A'}, ${sale.renk || 'N/A'}, ${sale.beden || 'N/A'})`}</td> <td>{sale.barcode}</td> <td>{sale.adet}</td> <td>{parseFloat(sale.satis_fiyati || 0).toFixed(2)} ₺</td> <td>{(parseFloat(sale.satis_fiyati || 0) * sale.adet).toFixed(2)} ₺</td> <td className="actions-cell"> <button onClick={() => openReturnModal(sale)} className="icon-button return-button" title="Satışı İade Al"><ReturnIcon /></button> </td> </tr> ))} </tbody> </table> </Modal> )} {returnModal.isOpen && ( <Modal isOpen={returnModal.isOpen} onClose={closeReturnModal} onConfirm={confirmReturn} title={`'${returnModal.sale.urun_ismi}' İade İşlemi`}> <div> <p>Bu üründen kaç adet iade etmek istiyorsunuz?</p> <input type="number" className="form-input" value={returnModal.quantity} onChange={(e) => { setReturnModal(prev => ({ ...prev, quantity: e.target.value })); }} min="1" max={returnModal.sale.adet} style={{ marginTop: '1rem', width: '100px' }} autoFocus /> <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem' }}> (Maksimum iade adedi: {returnModal.sale.adet}) </p> </div> </Modal> )} </div> );
}

// YENİ: Ana Uygulama Mantığı
function MainApp() {
    const [activeView, setActiveView] = useState('salesTerminal');
    const [modalState, setModalState] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
    const { logout } = useAuth();

    const showModal = (title, message, onConfirm = null) => {setModalState({ isOpen: true, title, message, onConfirm });};
    const closeModal = () => {setModalState({ ...modalState, isOpen: false });};
    const handleConfirm = () => {if (modalState.onConfirm) {modalState.onConfirm();}closeModal();};
    
    const renderView = () => {
        switch (activeView) {
            case 'salesTerminal': return <SalesTerminal showModal={showModal} />;
            case 'products': return <ProductManagement showModal={showModal} />;
            case 'salesReport': return <SalesReport showModal={showModal} />;
            default: return <SalesTerminal showModal={showModal} />;
        }
    };

    return (
        <SepetProvider showModal={showModal}>
            <ProductProvider showModal={showModal} isActive={activeView === 'products'}>
                <ReportProvider showModal={showModal} isActive={activeView === 'salesReport'}>
                    <div className="App-container">
                        <header className="app-header">
                            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%'}}>
                                <h1 className="app-title" style={{margin: 0}}>Stok Takip Sistemi</h1>
                                <button onClick={logout} className="button danger-button" title="Çıkış Yap">
                                    <LogoutIcon />
                                    <span style={{marginLeft: '0.5rem'}}>Çıkış Yap</span>
                                </button>
                            </div>
                            <nav className="main-nav" style={{marginTop: '1.5rem'}}>
                                <button onClick={() => setActiveView('salesTerminal')} className={activeView === 'salesTerminal' ? 'active' : ''}>Satış Ekranı</button>
                                <button onClick={() => setActiveView('products')} className={activeView === 'products' ? 'active' : ''}>Stok Yönetimi</button>
                                <button onClick={() => setActiveView('salesReport')} className={activeView === 'salesReport' ? 'active' : ''}>Satış Raporları</button>
                            </nav>
                        </header>
                        <main>{renderView()}</main>
                    </div>
                    <Modal isOpen={modalState.isOpen} onClose={closeModal} onConfirm={modalState.onConfirm ? handleConfirm : null} title={modalState.title}>
                        <p>{modalState.message}</p>
                    </Modal>
                </ReportProvider>
            </ProductProvider>
        </SepetProvider>
    );
}

// YENİ: Uygulamanın Kök Bileşeni
function App() {
    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    );
}

// YENİ: Giriş durumuna göre yönlendirme yapan bileşen
function AppContent() {
    const { token } = useAuth();
    // Eğer token varsa ana uygulamayı, yoksa giriş ekranını göster
    return token ? <MainApp /> : <Login />;
}

export default App;