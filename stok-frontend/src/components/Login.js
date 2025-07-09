// src/components/Login.js

import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(username, password);
            // Başarılı giriş sonrası App.js zaten yönlendirmeyi yapacak.
        } catch (err) {
            setError('Kullanıcı adı veya şifre hatalı. Lütfen tekrar deneyin.');
            console.error(err);
        }
        setLoading(false);
    };

    return (
        <div className="login-container">
            <div className="login-box card">
                <h1 className="app-title">Stok Takip Sistemi</h1>
                <h2 className="form-title">Kullanıcı Girişi</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-field">
                        <label htmlFor="username">Kullanıcı Adı</label>
                        <input
                            type="text"
                            id="username"
                            className="form-input"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            autoFocus
                        />
                    </div>
                    <div className="form-field">
                        <label htmlFor="password">Şifre</label>
                        <input
                            type="password"
                            id="password"
                            className="form-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    {error && <p className="error-message">{error}</p>}
                    <div className="form-buttons" style={{borderTop: 'none', paddingTop: '1rem'}}>
                         <button type="submit" className="button primary-button" disabled={loading}>
                            {loading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default Login;