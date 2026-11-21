import useSWR from "swr";
import * as CountryApi from '@/network/country-api'
import { AxiosError } from "axios";

export default function useCountry(name: string) {
    const { data, error, isLoading } = useSWR(name ? `country:${name}` : null, async () => {
        try {
            return await CountryApi.getCountry(name);
        } catch (error) {
            if (error instanceof AxiosError && error.response?.status === 404) {
                return null;
            } else {
                throw error;
            }
        }

    });
    return {
        country: data,
        countryLoading: isLoading,
        countryError: error,
    }
}