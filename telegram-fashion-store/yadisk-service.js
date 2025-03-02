// yadisk-service.js - Сервис для работы с Yandex Disk API
const axios = require('axios');
const FormData = require('form-data');
const config = require('./config');

class YandexDiskService {
  constructor() {
    this.token = config.YANDEX_DISK_TOKEN;
    this.baseUrl = 'https://cloud-api.yandex.net/v1/disk';
    this.basePath = config.YANDEX_DISK_FOLDER || 'app_images';
  }

  /**
   * Получает заголовки авторизации для запросов к API
   * @returns {Object} Заголовки с токеном авторизации
   */
  getAuthHeaders() {
    return {
      'Authorization': `OAuth ${this.token}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Создает папку на Яндекс.Диске, если она не существует
   * @param {string} path Путь к папке
   * @returns {Promise<boolean>} Результат создания папки
   */
  async createFolder(path) {
    try {
      const fullPath = `${this.basePath}/${path}`;
      const url = `${this.baseUrl}/resources`;
      
      const response = await axios.put(url, null, {
        headers: this.getAuthHeaders(),
        params: {
          path: fullPath
        }
      });
      
      return response.status === 201 || response.status === 409; // 201 - Created, 409 - Already exists
    } catch (error) {
      if (error.response && error.response.status === 409) {
        // Папка уже существует
        return true;
      }
      console.error('Ошибка создания папки на Яндекс.Диске:', error.message);
      throw error;
    }
  }

  /**
   * Получает URL для загрузки файла на Яндекс.Диск
   * @param {string} path Путь к файлу на Яндекс.Диске
   * @returns {Promise<string>} URL для загрузки файла
   */
  async getUploadUrl(path) {
    try {
      const url = `${this.baseUrl}/resources/upload`;
      
      const response = await axios.get(url, {
        headers: this.getAuthHeaders(),
        params: {
          path: path,
          overwrite: true
        }
      });
      
      return response.data.href;
    } catch (error) {
      console.error('Ошибка получения URL для загрузки:', error.message);
      throw error;
    }
  }

  /**
   * Загружает файл на Яндекс.Диск
   * @param {Buffer} fileBuffer Буфер файла
   * @param {string} fileName Имя файла
   * @param {string} folder Папка для загрузки (optional)
   * @returns {Promise<string>} Путь к загруженному файлу
   */
  async uploadFile(fileBuffer, fileName, folder = '') {
    try {
      // Проверяем существование базовой папки
      await this.createFolder('');
      
      // Если указана дополнительная папка, создаем ее
      if (folder) {
        await this.createFolder(folder);
      }
      
      const folderPath = folder ? `${this.basePath}/${folder}` : this.basePath;
      const filePath = `${folderPath}/${fileName}`;
      
      // Получаем URL для загрузки
      const uploadUrl = await this.getUploadUrl(filePath);
      
      // Загружаем файл
      await axios.put(uploadUrl, fileBuffer, {
        headers: {
          'Content-Type': 'application/octet-stream'
        }
      });
      
      return filePath;
    } catch (error) {
      console.error('Ошибка загрузки файла на Яндекс.Диск:', error.message);
      throw error;
    }
  }

  /**
   * Получает ссылку для скачивания файла с Яндекс.Диска
   * @param {string} path Путь к файлу на Яндекс.Диске
   * @returns {Promise<string>} Ссылка для скачивания файла
   */
  async getDownloadLink(path) {
    try {
      const url = `${this.baseUrl}/resources/download`;
      
      const response = await axios.get(url, {
        headers: this.getAuthHeaders(),
        params: {
          path: path
        }
      });
      
      // Получаем временную ссылку для скачивания
      const tempLink = response.data.href;
      
      // Получаем финальную ссылку для скачивания после редиректов
      const linkResponse = await axios.get(tempLink, {
        maxRedirects: 0,
        validateStatus: status => status >= 200 && status < 400
      }).catch(error => {
        if (error.response && error.response.headers.location) {
          return { headers: { location: error.response.headers.location } };
        }
        throw error;
      });
      
      return linkResponse.headers.location;
    } catch (error) {
      console.error('Ошибка получения ссылки для скачивания:', error.message);
      throw error;
    }
  }

  /**
   * Удаляет файл с Яндекс.Диска
   * @param {string} path Путь к файлу на Яндекс.Диске
   * @returns {Promise<boolean>} Результат удаления файла
   */
  async deleteFile(path) {
    try {
      const url = `${this.baseUrl}/resources`;
      
      const response = await axios.delete(url, {
        headers: this.getAuthHeaders(),
        params: {
          path: path,
          permanently: true
        }
      });
      
      return response.status === 204; // 204 - No Content (успешное удаление)
    } catch (error) {
      if (error.response && error.response.status === 404) {
        // Файл не найден, считаем операцию успешной
        return true;
      }
      console.error('Ошибка удаления файла с Яндекс.Диска:', error.message);
      throw error;
    }
  }

  /**
   * Получает информацию о файле на Яндекс.Диске
   * @param {string} path Путь к файлу на Яндекс.Диске
   * @returns {Promise<Object>} Информация о файле
   */
  async getFileInfo(path) {
    try {
      const url = `${this.baseUrl}/resources`;
      
      const response = await axios.get(url, {
        headers: this.getAuthHeaders(),
        params: {
          path: path
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Ошибка получения информации о файле:', error.message);
      throw error;
    }
  }

  /**
   * Получает список файлов в папке на Яндекс.Диске
   * @param {string} folderPath Путь к папке на Яндекс.Диске
   * @returns {Promise<Array>} Список файлов
   */
  async listFiles(folderPath = '') {
    try {
      const path = folderPath ? `${this.basePath}/${folderPath}` : this.basePath;
      const url = `${this.baseUrl}/resources`;
      
      const response = await axios.get(url, {
        headers: this.getAuthHeaders(),
        params: {
          path: path,
          limit: 100,
          fields: '_embedded.items.name,_embedded.items.path,_embedded.items.type,_embedded.items.size'
        }
      });
      
      return response.data._embedded.items;
    } catch (error) {
      console.error('Ошибка получения списка файлов:', error.message);
      throw error;
    }
  }
}

module.exports = new YandexDiskService();