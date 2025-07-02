import React, { createContext, useState, useContext, useCallback, useMemo, useEffect } from 'react';
import axios from 'axios';

// 1. Context'i oluştur
const ProductContext = createContext();

// 2. Kolay kullanım için hook'u oluştur
export function useProduct() {
  return useContext(ProductContext);
}

// Form için başlangıç state'i
const initialFormState = {isim: '', barcode: '', renk: '', beden: '', stokadedi: '',alisfiyati: '', satisfiyati: '', cinsiyet: ''};

// 3. Provider'ı oluştur
export function ProductProvider({ children, showModal, isActive }) {
    // Stok yönetimi sayfasının tüm state'leri artık burada
    const [groupedProducts, setGroupedProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState(initialFormState);
    const [editingProductId, setEditingProductId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selections, setSelections] = useState({});

    // Fonksiyonların hepsi de buraya taşındı
    const fetchGroupedProducts = useCallback(() => {
        setLoading(true);
        axios.get('http://127.0.0.1:5000/api/grouped-products')
            .then(res => setGroupedProducts(res.data))
            .catch(err => showModal('Hata', 'Gruplanmış ürünler yüklenemedi.'))
            .finally(() => setLoading(false));
    }, [showModal]);

    // Sadece bu sekme aktif olduğunda ürünleri çekmek için
    useEffect(() => {
        if (isActive) {
            fetchGroupedProducts();
        }
    }, [isActive, fetchGroupedProducts]);

    const handleSelectionChange = (groupName, field, value) => {
        const newSelections = { ...selections };
        const currentGroupSelection = newSelections[groupName] || {};
        if (field === 'gender') {
            newSelections[groupName] = { gender: value, color: '', size: '' };
        } else if (field === 'color') {
            newSelections[groupName] = { ...currentGroupSelection, color: value, size: '' };
        } else {
            newSelections[groupName] = { ...currentGroupSelection, [field]: value };
        }
        setSelections(newSelections);
    };
    
    useEffect(() => {
        if (!searchTerm || !groupedProducts.length) return;
        let uniqueVariant = null;
        let matchCount = 0;
        let matchedGroupName = '';
        for (const group of groupedProducts) {
            for (const variant of group.varyasyonlar) {
                if (variant.barcode === searchTerm) {
                    uniqueVariant = variant;
                    matchedGroupName = group.urun_ismi;
                    matchCount++;
                }
            }
        }
        if (matchCount === 1 && uniqueVariant) {
            setSelections(prev => ({...prev,[matchedGroupName]: {gender: uniqueVariant.cinsiyet || '',color: uniqueVariant.renk || '',size: uniqueVariant.beden || ''}}));
        }
    }, [searchTerm, groupedProducts]);

    const handleInputChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
    const handleClearForm = () => { setFormData(initialFormState); };
    const handleCancelEdit = () => { setEditingProductId(null); setFormData(initialFormState); };
    
    const handleEditClick = (product) => {
        setEditingProductId(product.id);
        const formReadyProduct = {};
        for (const key in initialFormState) {
            formReadyProduct[key] = product[key] === null ? '' : product[key];
        }
        setFormData(formReadyProduct);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const apiCall = editingProductId ? axios.put(`http://127.0.0.1:5000/api/products/${editingProductId}`, formData) : axios.post('http://127.0.0.1:5000/api/products', formData);
        apiCall.then(res => {
            showModal('Başarılı', res.data.mesaj);
            fetchGroupedProducts(); 
            if (editingProductId) {
                handleCancelEdit();
            }
        }).catch(err => showModal('Hata', `İşlem Başarısız: ${err.response?.data?.hata || 'Bir hata oluştu.'}`));
    };

    const handleGenerateBarcode = () => {
        axios.get('http://127.0.0.1:5000/api/generate-barcode')
            .then(res => setFormData({ ...formData, barcode: res.data.barcode }))
            .catch(err => showModal('Hata', 'Barkod üretilemedi.'));
    };

    const handleDelete = (productId, productName) => {
        showModal('Ürünü Sil', `"${productName}" adlı ürünü kalıcı olarak silmek istediğinizden emin misiniz?`,
        () => {
            axios.delete(`http://127.0.0.1:5000/api/products/${productId}`)
                .then(res => { showModal('Başarılı', res.data.mesaj); fetchGroupedProducts(); })
                .catch(err => showModal('Hata', `Ürün silinemedi: ${err.response?.data?.hata || 'Bilinmeyen hata.'}`));
        });
    };

    const filteredGroupedProducts = useMemo(() => {
        if (!searchTerm) return groupedProducts;
        const lowercasedTerm = searchTerm.toLowerCase();
        return groupedProducts.filter(group => group.urun_ismi.toLowerCase().includes(lowercasedTerm) || group.varyasyonlar.some(variant => variant.barcode === searchTerm));
    }, [searchTerm, groupedProducts]);

    // Tüm state ve fonksiyonları dışarıya aç
    const value = {
        groupedProducts, loading, formData, editingProductId, searchTerm, setSearchTerm,
        selections, fetchGroupedProducts, handleSelectionChange, handleInputChange,
        handleClearForm, handleCancelEdit, handleEditClick, handleSubmit,
        handleGenerateBarcode, handleDelete, filteredGroupedProducts
    };

    return <ProductContext.Provider value={value}>{children}</ProductContext.Provider>;
}
