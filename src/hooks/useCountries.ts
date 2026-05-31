import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { Country } from '@/types/country.type';
import { getCountryFlag } from '@/utils/countryFlags';

// Ensure every country has a flagUrl, falling back to flagcdn.com
function withFlagUrl(country: Country): Country {
  return {
    ...country,
    flagUrl: country.flagUrl || getCountryFlag(country.code),
  };
}

export function useCountries(includeUnsupported = false) {
  return useQuery({
    queryKey: ['countries', includeUnsupported],
    queryFn: async () => {
      const endpoint = includeUnsupported
        ? '/countries?includeUnsupported=true'
        : '/countries';
      const response = await apiService.get<Country[]>(endpoint);
      return (response.data ?? []).map(withFlagUrl);
    },
    staleTime: 1000 * 60 * 60, // 1 hour - countries rarely change
  });
}

export function useCountry(code: string) {
  return useQuery({
    queryKey: ['country', code],
    queryFn: async () => {
      const response = await apiService.get<Country>(`/countries/${code}`);
      return response.data ? withFlagUrl(response.data) : undefined;
    },
    enabled: !!code,
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}
