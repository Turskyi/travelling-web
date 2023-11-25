import axios from "axios";

const axiosInstance = axios.create({
    baseURL: 'https://restcountries.com/',
    timeout: 5000,
});

export default axiosInstance;