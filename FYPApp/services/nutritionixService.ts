const NUTRITIONIX_APP_ID = 'af25b1a8';
const NUTRITIONIX_APP_KEY = '1902c21626133aa332a2856f0d10eeab';

export const searchDishes = async (query: string) => {
  try {
    const res = await fetch('https://trackapi.nutritionix.com/v2/search/instant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-app-id': NUTRITIONIX_APP_ID,
        'x-app-key': NUTRITIONIX_APP_KEY,
      },
      body: JSON.stringify({ 
        query,
        detailed: true, 
        common: true,  
        branded: false 
      })
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Nutritionix API error: ${res.status} ${res.statusText} - ${errorBody}`);
    }

    const data = await res.json();
    const commonFoods = data.common || [];
    return commonFoods;
  } catch (error) {
    console.error('Error fetching from Nutritionix API:', error);
    throw error;
  }
};