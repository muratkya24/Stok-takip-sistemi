// src/contexts/AuthContext.js

import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    // Token'ı tarayıcının yerel hafızasında (localStorage) saklayacağız.
    const [token, setToken] = useState(localStorage.getItem('token'));

    // Axios için bir interceptor (araya girici) kuruyoruz.
    // Bu, her API isteği gönderilmeden önce araya girip, eğer token varsa,
    // isteğin header'ına (başlığına) otomatik olarak ekler.
    useEffect(() => {
        const interceptor = axios.interceptors.request.use(
            (config) => {
                const storedToken = localStorage.getItem('token');
                if (storedToken) {
                    config.headers['x-access-token'] = storedToken;
                }
                return config;
            },
            (error) => {
                return Promise.reject(error);
            }
        );

        // Bileşen kaldırıldığında interceptor'ı temizle
        return () => {
            axios.interceptors.request.eject(interceptor);
        };
    }, []);


    const login = async (username, password) => {
        // Backend'deki /api/login endpoint'ine istek atıyoruz.
        // Basic Auth için kullanıcı adı ve şifreyi `auth` objesi içinde gönderiyoruz.
        const response = await axios.post('https://muratkya244.pythonanywhere.com/api/login', {}, {
            auth: {
                username,
                password
            }
        });

        if (response.data.token) {
            localStorage.setItem('token', response.data.token);
            setToken(response.data.token);
        }
        return response;
    };

    const logout = () => {
        localStorage.removeItem('token');
        setToken(null);
    };

    const value = {
        token,
        login,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}
