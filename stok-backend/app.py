# app.py

from flask import Flask, jsonify, request
from flask_cors import CORS
import mysql.connector
import decimal, datetime, json, random, barcode

app = Flask(__name__)
CORS(app)

# --- YARDIMCI FONKSİYONLAR VE AYARLAR ---
def json_serializer(obj):
    if isinstance(obj, decimal.Decimal): return str(obj)
    if isinstance(obj, datetime.datetime): return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")

db_config = {'host': 'localhost', 'user': 'root', 'password': '147147', 'database': 'stokdb'}

def get_db_connection():
    try:
        conn = mysql.connector.connect(**db_config)
        return conn
    except mysql.connector.Error as err:
        print(f"Veritabanı bağlantı hatası: {err}")
        return None

# --- API ENDPOINT'LERİ ---

# --- BARKOD İLE TEK ÜRÜN GETİRME ---
@app.route('/api/products/by-barcode/<string:barcode_value>', methods=['GET'])
def get_product_by_barcode(barcode_value):
    conn = get_db_connection()
    if conn is None: return jsonify({"hata": "Veritabanı bağlantısı kurulamadı"}), 500
    cursor = conn.cursor(dictionary=True)
    clean_barcode = barcode_value.strip()
    cursor.execute("SELECT * FROM products WHERE TRIM(barcode) = %s", (clean_barcode,))
    product = cursor.fetchone()
    cursor.close()
    conn.close()
    if product:
        for key, value in product.items():
            product[key] = json_serializer(value) if isinstance(value, (decimal.Decimal, datetime.datetime)) else value
        return jsonify(product)
    else:
        return jsonify({'hata': 'Bu barkoda sahip ürün bulunamadı'}), 404

# --- TOPLU SATIŞ (SEPET) İŞLEMİ ---
@app.route('/api/sales/bulk', methods=['POST'])
def make_bulk_sale():
    basket_data = request.get_json()
    if not basket_data or 'basket' not in basket_data:
        return jsonify({'hata': 'Geçersiz sepet verisi!'}), 400
    
    basket = basket_data['basket']
    if not basket:
        return jsonify({'hata': 'Sepet boş olamaz!'}), 400

    conn = get_db_connection()
    if conn is None: return jsonify({"hata": "Veritabanı bağlantısı kurulamadı"}), 500
    
    cursor = conn.cursor(dictionary=True)
    try:
        conn.start_transaction()
        sale_timestamp = datetime.datetime.now() # Tüm işlem için tek bir zaman damgası
        for item in basket:
            product_id = item.get('id')
            quantity_sold = item.get('quantity')
            
            cursor.execute("SELECT isim, stokadedi, satisfiyati FROM products WHERE id = %s FOR UPDATE", (product_id,))
            product = cursor.fetchone()
            if not product or product['stokadedi'] < quantity_sold:
                conn.rollback()
                return jsonify({'hata': f"'{item.get('isim')}' adlı ürün için yeterli stok yok (Kalan: {product['stokadedi'] if product else 0})!"}), 400
            
            cursor.execute("UPDATE products SET stokadedi = stokadedi - %s WHERE id = %s", (quantity_sold, product_id))
            
            cursor.execute(
                "INSERT INTO satislar (product_id, adet, satis_fiyati, satis_tarihi) VALUES (%s, %s, %s, %s)",
                (product_id, quantity_sold, product['satisfiyati'], sale_timestamp)
            )
        
        conn.commit()
        return jsonify({'mesaj': 'Toplu satış başarıyla tamamlandı!'}), 201

    except mysql.connector.Error as err:
        conn.rollback()
        return jsonify({'hata': f'Toplu satış sırasında bir hata oluştu: {err}'}), 500
    finally:
        cursor.close()
        conn.close()

# --- SATIŞ RAPORLARI (GÜNCELLENDİ) ---
@app.route('/api/sales', methods=['GET'])
def get_sales():
    filter_date = request.args.get('date');
    conn = get_db_connection();
    if conn is None: return jsonify({"hata": "Veritabanı bağlantısı kurulamadı"}), 500
    cursor = conn.cursor(dictionary=True);
    # GÜNCELLENDİ: Cinsiyet bilgisi sorguya eklendi (p.cinsiyet)
    query = "SELECT s.id, s.satis_tarihi, s.satis_fiyati, s.adet, p.isim AS urun_ismi, p.barcode, p.renk, p.beden, p.cinsiyet, p.alisfiyati FROM satislar AS s JOIN products AS p ON s.product_id = p.id"
    params = []
    if filter_date:
        query += " WHERE DATE(s.satis_tarihi) = %s"
        params.append(filter_date)
    query += " ORDER BY s.satis_tarihi DESC"
    cursor.execute(query, tuple(params))
    sales = cursor.fetchall();
    cursor.close(); conn.close()
    response = app.response_class(response=json.dumps(sales, default=json_serializer), status=200, mimetype='application/json')
    return response

# --- YENİ: KISMİ İADE ENDPOINT'İ ---
@app.route('/api/sales/return', methods=['POST'])
def return_sale_partial():
    data = request.get_json()
    sale_id = data.get('sale_id')
    quantity_to_return = data.get('quantity')

    if not sale_id or not quantity_to_return:
        return jsonify({'hata': 'Eksik bilgi: sale_id ve quantity gereklidir.'}), 400
    
    try:
        quantity_to_return = int(quantity_to_return)
        if quantity_to_return <= 0:
            return jsonify({'hata': 'İade adedi 0 dan büyük olmalıdır.'}), 400
    except (ValueError, TypeError):
        return jsonify({'hata': 'Geçersiz iade adedi.'}), 400

    conn = get_db_connection()
    if conn is None: return jsonify({"hata": "Veritabanı bağlantısı kurulamadı"}), 500
    cursor = conn.cursor(dictionary=True)

    try:
        conn.start_transaction()
        cursor.execute("SELECT product_id, adet FROM satislar WHERE id = %s FOR UPDATE", (sale_id,))
        sale_to_return = cursor.fetchone()

        if not sale_to_return:
            conn.rollback()
            return jsonify({'hata': 'İade edilecek satış kaydı bulunamadı.'}), 404

        product_id = sale_to_return['product_id']
        original_quantity = sale_to_return['adet']

        if quantity_to_return > original_quantity:
            conn.rollback()
            return jsonify({'hata': f'İade adedi ({quantity_to_return}), satılan adetten ({original_quantity}) fazla olamaz.'}), 400

        cursor.execute("UPDATE products SET stokadedi = stokadedi + %s WHERE id = %s", (quantity_to_return, product_id))

        if quantity_to_return == original_quantity:
            cursor.execute("DELETE FROM satislar WHERE id = %s", (sale_id,))
        else:
            new_quantity = original_quantity - quantity_to_return
            cursor.execute("UPDATE satislar SET adet = %s WHERE id = %s", (new_quantity, sale_id))

        conn.commit()
        return jsonify({'mesaj': 'Satış iadesi başarıyla gerçekleştirildi. Stok güncellendi.'}), 200

    except mysql.connector.Error as err:
        conn.rollback()
        return jsonify({'hata': f'İade işlemi sırasında bir veritabanı hatası oluştu: {err}'}), 500
    finally:
        cursor.close()
        conn.close()

# --- Diğer Endpoint'ler (Değişiklik yok) ---
@app.route('/api/grouped-products', methods=['GET'])
def get_grouped_products():
    conn = get_db_connection();
    if conn is None: return jsonify({"hata": "Veritabanı bağlantısı kurulamadı"}), 500
    cursor = conn.cursor(dictionary=True);
    cursor.execute("SELECT id, isim, barcode, renk, beden, cinsiyet, stokadedi, satisfiyati, alisfiyati FROM products ORDER BY isim, renk, beden")
    all_products = cursor.fetchall();
    cursor.close(); conn.close()
    grouped = {};
    for product in all_products:
        name = product['isim']
        if name not in grouped: grouped[name] = {'urun_ismi': name, 'varyasyonlar': []}
        grouped[name]['varyasyonlar'].append(product)
    response_data = list(grouped.values())
    response = app.response_class(response=json.dumps(response_data, default=json_serializer), status=200, mimetype='application/json')
    return response

@app.route('/api/generate-barcode', methods=['GET'])
def generate_barcode():
    conn = None;
    try:
        conn = get_db_connection();
        if conn is None: return jsonify({"hata": "Veritabanı bağlantısı kurulamadı"}), 500
        cursor = conn.cursor();
        max_attempts = 100
        for attempt in range(max_attempts):
            random_12_digits = ''.join([str(random.randint(0, 9)) for _ in range(12)])
            cursor.execute("SELECT id FROM products WHERE barcode LIKE %s", (f"{random_12_digits}%",))
            if not cursor.fetchone():
                ean = barcode.get('ean13', random_12_digits);
                return jsonify({'barcode': ean.get_fullcode()})
        return jsonify({'hata': 'Benzersiz barkod üretilemedi, lütfen tekrar deneyin.'}), 500
    except Exception as e:
        return jsonify({'hata': f'Sunucu hatası: {e}'}), 500
    finally:
        if conn and conn.is_connected():
            cursor.close();
            conn.close()

@app.route('/api/products', methods=['POST'])
def add_product():
    yeni_urun = request.get_json();
    if not yeni_urun or 'isim' not in yeni_urun or not yeni_urun.get('satisfiyati'): return jsonify({'hata': 'İsim ve Satış Fiyatı alanları zorunludur!'}), 400
    conn = get_db_connection();
    if conn is None: return jsonify({"hata": "Veritabanı bağlantısı kurulamadı"}), 500
    cursor = conn.cursor()
    sql = "INSERT INTO products (isim, barcode, renk, beden, stokadedi, alisfiyati, satisfiyati, cinsiyet) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)"
    alisfiyati = yeni_urun.get('alisfiyati'); stokadedi = yeni_urun.get('stokadedi')
    if alisfiyati == '': alisfiyati = None
    if stokadedi == '' or stokadedi is None: stokadedi = 0
    data = (yeni_urun.get('isim'), yeni_urun.get('barcode'), yeni_urun.get('renk'), yeni_urun.get('beden'), stokadedi, alisfiyati, yeni_urun.get('satisfiyati'), yeni_urun.get('cinsiyet'))
    try:
        cursor.execute(sql, data);
        conn.commit()
        yeni_id = cursor.lastrowid; cursor.close(); conn.close()
        return jsonify({'mesaj': 'Ürün başarıyla eklendi', 'id': yeni_id}), 201
    except mysql.connector.Error as err:
        return jsonify({'hata': f'Veritabanı hatası: {err}'}), 500

@app.route('/api/products/<int:product_id>', methods=['PUT'])
def update_product(product_id):
    guncel_veri = request.get_json();
    if not guncel_veri or 'isim' not in guncel_veri or not guncel_veri.get('satisfiyati'): return jsonify({'hata': 'İsim ve Satış Fiyatı alanları zorunludur!'}), 400
    conn = get_db_connection();
    if conn is None: return jsonify({"hata": "Veritabanı bağlantısı kurulamadı"}), 500
    cursor = conn.cursor()
    sql = "UPDATE products SET isim=%s, barcode=%s, renk=%s, beden=%s, stokadedi=%s, alisfiyati=%s, satisfiyati=%s, cinsiyet=%s WHERE id=%s"
    alisfiyati = guncel_veri.get('alisfiyati'); stokadedi = guncel_veri.get('stokadedi')
    if alisfiyati == '': alisfiyati = None
    if stokadedi == '' or stokadedi is None: stokadedi = 0
    data = (guncel_veri.get('isim'), guncel_veri.get('barcode'), guncel_veri.get('renk'), guncel_veri.get('beden'), stokadedi, alisfiyati, guncel_veri.get('satisfiyati'), guncel_veri.get('cinsiyet'), product_id)
    try:
        cursor.execute(sql, data);
        conn.commit(); cursor.close(); conn.close()
        return jsonify({'mesaj': f'ID: {product_id} olan ürün başarıyla güncellendi'}), 200
    except mysql.connector.Error as err:
        return jsonify({'hata': f'Veritabanı hatası: {err}'}), 500

@app.route('/api/products/<int:product_id>', methods=['DELETE'])
def delete_product(product_id):
    conn = get_db_connection();
    if conn is None: return jsonify({"hata": "Veritabanı bağlantısı kurulamadı"}), 500
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id FROM products WHERE id = %s", (product_id,));
        if not cursor.fetchone(): return jsonify({'hata': 'Silinecek ürün bulunamadı'}), 404
        cursor.execute("DELETE FROM products WHERE id = %s", (product_id,));
        conn.commit(); cursor.close(); conn.close()
        return jsonify({'mesaj': f'ID: {product_id} olan ürün başarıyla silindi'}), 200
    except mysql.connector.Error as err:
        return jsonify({'hata': f'Veritabanı hatası: {err}'}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
