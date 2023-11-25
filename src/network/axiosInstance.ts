import axios from "axios";

const axiosInstance = axios.create({
    baseURL: 'https://restcountries.com/',
    // The timeout option specifies the number of milliseconds before the request is aborted if the server does not respond.
    timeout: 5000,
});

export default axiosInstance;