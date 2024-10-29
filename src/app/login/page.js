'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import Image from 'next/image.js';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('/api/auth/login', { password });
      if (response.status === 200) {
        router.push('/'); // Redirect to the main page if successful
      }
    } catch (err) {
      setError('Invalid password');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-500 p-4">
      <a href="https://next-level.com/" target="_blank" rel="noopener noreferrer">
        <Image
          className="p-5 rounded-lg"
          src="https://next-level.com/wp-content/uploads/2021/11/nextlevel_RGB_claimless_color_EPS-1-1.svg"
          alt="Next.js logo"
          width={200}
          height={50}
          priority
        />
      </a>
      <form onSubmit={handleLogin} className="bg-white shadow-md rounded-lg p-6 space-y-4 w-full max-w-md">
        <h1 className="text-3xl font-bold mb-6 text-black text-center">Login to the App</h1>
        <div>
          <label className="block text-gray-700 font-medium mb-2" htmlFor="password">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter the app password"
            required
            className="w-full border border-gray-300 rounded-md p-2"
          />
        </div>
        {error && <p className="text-red-500">{error}</p>}
        <button
          type="submit"
          className="w-full bg-blue-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-600"
        >
          Login
        </button>
      </form>
    </div>
  );
}
