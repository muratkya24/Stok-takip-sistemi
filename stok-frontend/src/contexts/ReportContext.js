import React, { createContext, useState, useContext, useCallback, useMemo, useEffect } from 'react';
import axios from 'axios';

const ReportContext = createContext();

export function useReport() {
    return useContext(ReportContext);
}

const getTodayString = () => {
    const today = new Date();
    const timezoneOffset = today.getTimezoneOffset() * 60000;
    const localDate = new Date(today.getTime() - timezoneOffset);
    return localDate.toISOString().split('T')[0];
};

export function ReportProvider({ children, showModal, isActive }) {
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(getTodayString());

    const fetchSales = useCallback(() => {
        if (!selectedDate) {
            setSales([]);
            return;
        }
        setLoading(true);
        // GÜNCELLENDİ: URL canlı sunucu adresine çevrildi
        axios.get(`https://muratkya244.pythonanywhere.com/api/sales?date=${selectedDate}`)
            .then(res => setSales(res.data))
            .catch(err => {
                console.error("Satış raporu alınırken hata oluştu!", err);
                showModal("Hata", "Seçilen tarihe ait satış raporu verileri yüklenemedi.");
            })
            .finally(() => setLoading(false));
    }, [selectedDate, showModal]);
    
    useEffect(() => {
        if (isActive) {
            fetchSales();
        }
    }, [isActive, fetchSales]);

    const groupedSales = useMemo(() => {
        if (!sales || sales.length === 0) return [];
        const groups = sales.reduce((acc, sale) => {
            const timestamp = sale.satis_tarihi;
            if (!acc[timestamp]) {
                acc[timestamp] = [];
            }
            acc[timestamp].push(sale);
            return acc;
        }, {});
        return Object.values(groups).map(groupItems => {
            const totalItems = groupItems.reduce((sum, item) => sum + (item.adet || 1), 0);
            const totalAmount = groupItems.reduce((sum, item) => sum + (parseFloat(item.satis_fiyati || 0) * (item.adet || 1)), 0);
            return {
                id: groupItems[0].satis_tarihi,
                timestamp: groupItems[0].satis_tarihi,
                items: groupItems,
                totalItems,
                totalAmount
            };
        });
    }, [sales]);

    const handleReturn = (saleId, quantity, successCallback) => {
        const returnData = { sale_id: saleId, quantity: quantity };
        // GÜNCELLENDİ: URL canlı sunucu adresine çevrildi
        axios.post('https://muratkya244.pythonanywhere.com/api/sales/return', returnData)
            .then(res => {
                showModal('Başarılı', res.data.mesaj);
                fetchSales(); // Verileri yenile
                if (successCallback) successCallback();
            })
            .catch(err => {
                showModal('Hata', `İade işlemi başarısız: ${err.response?.data?.hata || 'Bilinmeyen hata.'}`);
            });
    };

    const { totalRevenue, totalProfit } = useMemo(() => {
        const revenue = sales.reduce((total, sale) => total + (parseFloat(sale.satis_fiyati || 0) * (sale.adet || 1)), 0);
        const cost = sales.reduce((total, sale) => total + (parseFloat(sale.alisfiyati || 0) * (sale.adet || 1)), 0);
        const profit = revenue - cost;
        return { totalRevenue: revenue, totalProfit: profit };
    }, [sales]);

    const value = {
        sales,
        groupedSales,
        loading,
        selectedDate,
        setSelectedDate,
        handleReturn,
        totalRevenue,
        totalProfit
    };

    return <ReportContext.Provider value={value}>{children}</ReportContext.Provider>;
}
