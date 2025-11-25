/**
 * Parse URL parameters from both before and after the hash
 * This handles both BrowserRouter and HashRouter cases
 */
export function getAllUrlParams(): URLSearchParams {
  const params = new URLSearchParams();
  
  // Get params before hash (e.g., ?shop=example.com#/login)
  if (window.location.search) {
    const beforeHash = new URLSearchParams(window.location.search);
    beforeHash.forEach((value, key) => {
      params.set(key, value);
    });
  }
  
  // Get params after hash (e.g., #/login?shop=example.com)
  if (window.location.hash.includes('?')) {
    const hashParts = window.location.hash.split('?');
    if (hashParts[1]) {
      const afterHash = new URLSearchParams(hashParts[1]);
      afterHash.forEach((value, key) => {
        params.set(key, value);
      });
    }
  }
  
  return params;
}
