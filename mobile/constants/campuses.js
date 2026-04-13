/**
 * Northeastern University global campuses.
 *
 * `id`     — matches the `campus` column that will be added to the Supabase `locations` table.
 * `center` — map center { lat, lng } to pan to when the campus is selected.
 * `zoom`   — default zoom level for that campus.
 */
export const CAMPUSES = [
  // Sorted by state abbreviation, then by city name
  { id: "oakland",    name: "Oakland",    state: "CA",  center: { lat: 37.78074, lng: -122.18260 }, zoom: 16 },
  { id: "san_jose",   name: "San Jose",   state: "CA",  center: { lat: 37.33773, lng: -121.88974 }, zoom: 16 },
  { id: "miami",      name: "Miami",      state: "FL",  center: { lat: 25.80002, lng: -80.19966  }, zoom: 16 },
  { id: "boston",     name: "Boston",     state: "MA",  center: { lat: 42.3398, lng: -71.0892  }, zoom: 16 },
  { id: "burlington", name: "Burlington", state: "MA",  center: { lat: 42.47854, lng: -71.19190  }, zoom: 16 },
  { id: "portland",   name: "Portland",   state: "ME",  center: { lat: 43.66169, lng: -70.24668  }, zoom: 16 },
  { id: "charlotte",  name: "Charlotte",  state: "NC",  center: { lat: 35.20927, lng: -80.86198  }, zoom: 16 },
  { id: "new_york",   name: "New York",   state: "NY",  center: { lat: 40.76900, lng: -73.95995  }, zoom: 16 },
  { id: "toronto",    name: "Toronto",    state: "ON",  center: { lat: 43.64906, lng: -79.39389  }, zoom: 16 },
  { id: "london",     name: "London",     state: "UK",  center: { lat: 51.50623, lng: -0.07128   }, zoom: 15 },
  { id: "arlington",  name: "Arlington",  state: "VA",  center: { lat: 38.89391, lng: -77.07265  }, zoom: 16 },
  { id: "seattle",    name: "Seattle",    state: "WA",  center: { lat: 47.62300, lng: -122.33736 }, zoom: 16 },
];

/**
 * Hardcoded buildings for the Boston campus used by the MapPage navigation search.
 * Other campuses will be populated once their CSVs are imported into Supabase.
 */
export const BUILDINGS_BY_CAMPUS = {
  boston: [
    { name: "Snell Library",              lat: 42.3386, lng: -71.0881 },
    { name: "Curry Student Center",       lat: 42.3391, lng: -71.0875 },
    { name: "Krentzman Quad",             lat: 42.3401, lng: -71.0882 },
    { name: "Ell Hall",                   lat: 42.3399, lng: -71.0881 },
    { name: "Richards Hall",              lat: 42.3399, lng: -71.0887 },
    { name: "Shillman Hall",              lat: 42.3376, lng: -71.0902 },
    { name: "Ryder Hall",                 lat: 42.3367, lng: -71.0906 },
    { name: "Hayden Hall",                lat: 42.3393, lng: -71.0885 },
    { name: "Robinson Hall",              lat: 42.3393, lng: -71.0868 },
    { name: "Kariotis Hall",              lat: 42.3386, lng: -71.0909 },
    { name: "Mugar Life Sciences",        lat: 42.3397, lng: -71.0870 },
    { name: "Forsyth Building",           lat: 42.3386, lng: -71.0899 },
    { name: "Behrakis Health Sciences",   lat: 42.3370, lng: -71.0914 },
    { name: "Churchill Hall",             lat: 42.3388, lng: -71.0889 },
    { name: "Dodge Hall",                 lat: 42.3403, lng: -71.0878 },
    { name: "Dockser Hall",               lat: 42.3386, lng: -71.0902 },
    { name: "Lake Hall",                  lat: 42.3383, lng: -71.0908 },
    { name: "Holmes Hall",                lat: 42.3381, lng: -71.0908 },
    { name: "Nightingale Hall",           lat: 42.3381, lng: -71.0901 },
    { name: "Meserve Hall",               lat: 42.3376, lng: -71.0909 },
    { name: "Stearns Center",             lat: 42.3390, lng: -71.0914 },
    { name: "Cullinane Hall",             lat: 42.3383, lng: -71.0892 },
    { name: "White Hall",                 lat: 42.3420, lng: -71.0905 },
    { name: "West Village F",             lat: 42.3373, lng: -71.0914 },
    { name: "West Village G",             lat: 42.3380, lng: -71.0922 },
    { name: "West Village H",             lat: 42.3388, lng: -71.0921 },
    { name: "International Village",      lat: 42.3350, lng: -71.0888 },
    { name: "Stetson West",               lat: 42.3412, lng: -71.0903 },
    { name: "LightView",                  lat: 42.3371, lng: -71.0855 },
    { name: "Speare Hall",                lat: 42.3407, lng: -71.0897 },
    { name: "Willis Hall",                lat: 42.3382, lng: -71.0913 },
    { name: "Smith Hall",                 lat: 42.3425, lng: -71.0906 },
    { name: "Rubenstein Hall",            lat: 42.3383, lng: -71.0935 },
    { name: "Melvin Hall",                lat: 42.3421, lng: -71.0912 },
    { name: "Hastings Hall",              lat: 42.3381, lng: -71.0908 },
    { name: "Cabot Center",               lat: 42.3393, lng: -71.0893 },
    { name: "Marino Rec Center",          lat: 42.3402, lng: -71.0903 },
    { name: "Parsons Field",              lat: 42.3374, lng: -71.1140 },
    { name: "ISEC",                       lat: 42.3377, lng: -71.0870 },
    { name: "Egan Research Center",       lat: 42.3377, lng: -71.0889 },
    { name: "Khoury College",             lat: 42.3385, lng: -71.0923 },
    { name: "East Village",               lat: 42.3404, lng: -71.0869 },
    { name: "Alumni Center",              lat: 42.3377, lng: -71.0853 },
    { name: "Ruggles MBTA",               lat: 42.3371, lng: -71.0894 },
    { name: "NEU MBTA (Green)",           lat: 42.3404, lng: -71.0894 },
    { name: "Centennial Common",          lat: 42.3371, lng: -71.0905 },
    { name: "O'Bryant Institute",         lat: 42.3376, lng: -71.0913 },
    { name: "Columbus Garage",            lat: 42.3380, lng: -71.0864 },
    { name: "Renaissance Garage",         lat: 42.3363, lng: -71.0884 },
    { name: "Stetson East",               lat: 42.3414, lng: -71.0902 },
  ].sort((a, b) => a.name.localeCompare(b.name)),

  // Additional campuses will be populated once CSVs are imported to Supabase.
  london:     [],
  new_york:   [],
  oakland:    [],
  charlotte:  [],
  miami:      [],
  portland:   [],
  san_jose:   [],
  seattle:    [],
  toronto:    [],
  arlington:  [],
  burlington: [],
};
