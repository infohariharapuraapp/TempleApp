import { getToken } from '@/services/authStorage';

//const API_BASE_URL = 'https://templeapp-s96e.onrender.com/api';
//const API_BASE_URL = 'http://192.168.0.122:5000/api';
//const API_BASE_URL = 'https://monk0y8jf9.execute-api.ap-south-1.amazonaws.com/api';

// Local backend testing through USB
//const API_BASE_URL = 'http://127.0.0.1:5000/api';

// Production backend
 const API_BASE_URL = 'https://templeapp-s96e.onrender.com/api';


type ApiOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: any;
  token?: string;
};

export async function apiRequest<T = any>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> {
  const {
    method = 'GET',
    body,
    token,
  } = options;

  const authToken =
    token || await getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (authToken) {
    headers.Authorization =
      `Bearer ${authToken}`;
  }

  const response = await fetch(
    `${API_BASE_URL}${endpoint}`,
    {
      method,
      headers,
      body: body
        ? JSON.stringify(body)
        : undefined,
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message ||
      'Something went wrong'
    );
  }

  return data as T;
}

export { API_BASE_URL };