const express = require('express');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

/**
 * OCR.space API 
 * @param {string} base64Image
 * @returns {Promise<string|null>}
 */
async function detectNumbersWithOCRSpace(base64Image) {
    console.log('Đang nhận diện số trong captcha bằng OCR.space API...');
    
    try {
        // Convert base64 to buffer and save as temp file
        const imageBuffer = Buffer.from(base64Image, 'base64');
        const tempImagePath = path.join(__dirname, 'temp_captcha_ocr.jpg');
        fs.writeFileSync(tempImagePath, imageBuffer);
        
        // OCR.space API endpoint
        const apiUrl = 'https://api.ocr.space/parse/image';
        
        console.log('Đang gửi ảnh đến OCR.space API...');
        
        // Use FormData for file upload
        const formData = new FormData();
        formData.append('file', fs.createReadStream(tempImagePath));
        formData.append('language', 'eng');
        formData.append('isOverlayRequired', 'false');
        formData.append('detectOrientation', 'false');
        formData.append('scale', 'true');
        formData.append('OCREngine', '2'); // Engine 2 is better for numbers
        
        const response = await axios.post(apiUrl, formData, {
            headers: {
                ...formData.getHeaders(),
                'apikey': 'helloworld' // Free tier key, replace with your own if needed
            }
        });
        
        // Clean up temp file
        if (fs.existsSync(tempImagePath)) {
            fs.unlinkSync(tempImagePath);
        }

        if (response.data && response.data.ParsedResults && response.data.ParsedResults.length > 0) {
            const parsedText = response.data.ParsedResults[0].ParsedText;
            
            // Thay thế chữ o và O thành số 0, sau đó chỉ lấy số
            let numbers = parsedText.replace(/[oO]/g, '0').replace(/\D/g, '').trim();
            
            // Validate: must have exactly 4 digits
            if (numbers && numbers.length === 4) {
                console.log('═══════════════════════════════════════');
                console.log(`✅ Số được nhận diện: ${numbers}`);
                console.log('═══════════════════════════════════════');
                console.log(`Text gốc từ API: "${parsedText.trim()}"`);
                return numbers;
            } else if (numbers && numbers.length > 0) {
                console.log('═══════════════════════════════════════');
                console.log(`❌ Kết quả không đúng: "${numbers}" (${numbers.length} số)`);
                console.log('⚠️  Captcha phải có đúng 4 số!');
                console.log(`Text gốc từ API: "${parsedText.trim()}"`);
                console.log('═══════════════════════════════════════');
                return null;
            } else {
                console.log('❌ Không tìm thấy số trong ảnh captcha.');
                console.log(`Text gốc từ API: "${parsedText.trim()}"`);
                return null;
            }
        } else {
            console.log('❌ API không trả về kết quả.');
            if (response.data.ErrorMessage) {
                console.log(`Lỗi: ${response.data.ErrorMessage}`);
            }
            return null;
        }
    } catch (error) {
        console.error('❌ Lỗi:', error.message);
        if (error.response) {
            console.error('Response:', error.response.data);
        }
        return null;
    }
}

app.post('/detect-capcha', async (req, res) => {
    try {
        const { image, value } = req.body;

        if (!image) {
            return res.status(400).json({
                success: false,
                numbers: null,
                value: value,
                message: 'Thiếu trường image trong request body'
            });
        }

        const numbers = await detectNumbersWithOCRSpace(image);

        if (numbers) {
            return res.json({
                success: true,
                numbers: numbers,
                value: value,
                message: 'Nhận diện thành công'
            });
        } else {
            return res.json({
                success: false,
                numbers: null,
                value: value,
                message: 'Không thể nhận diện được 4 số từ captcha'
            });
        }
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({
            success: false,
            numbers: null,
            value: value,
            message: `Lỗi server: ${error.message}`
        });
    }
});

// 健康检查端点
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'API is running' });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
    console.log(`📡 API endpoint: POST http://localhost:${PORT}/detect-capcha`);
});

