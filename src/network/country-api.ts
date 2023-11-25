import { Country } from '@/models/Country';
import api from './axiosInstance';

export async function getCountry(name: string) {
    const response = await api.get<Country[]>('v3.1/name/' + name + '?fullText=true');
    return response.data[0];
}

export async function getCountries() {
    const response = await api.get<Country[]>('v3.1/all?fields=name,maps,flags,coatOfArms,capital,flag,population,languages');
    return response.data;
}