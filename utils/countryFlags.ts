export const getCountryFlag = (countryCode: string) => {
  return `https://flagcdn.com/${countryCode.toLowerCase()}.svg`;
};

export const countryCodeMap: { [key: string]: string } = {
  'United States': 'us',
  'United Kingdom': 'gb',
  'Canada': 'ca',
  'Australia': 'au',
  // Add more countries as needed
};
