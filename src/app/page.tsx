"use client";

import png from './images/loginPage.png';
import './globals.css';
import { useState } from "react";
import { useRouter } from "next/navigation"; // Import useRouter
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../app/firebaseConfig";
import { updateProfile } from "firebase/auth"; // import updateProfile from firebase/auth


const Login: React.FC = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSignUp = async () => {
    try {
      const email = `${username}@dummyemail.com`;
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log("User created:", userCredential.user);

      // ✨ Update the user's displayName
      await updateProfile(userCredential.user, {
        displayName: username,
      });

      setError(null);
      router.push(`/home`); // No need to send username in URL anymore
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLogin = async () => {
    try {
      const email = `${username}@dummyemail.com`;
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log("User signed in:", userCredential.user);
      setError(null);
      router.push(`/home`); // No need to send username
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    /* color palette */
    <div className='flex flex-col-reverse lg:flex-row min-h-screen min-w-screen items-center justify-evenly'>
      <div className='flex flex-1/2 items-center justify-center'>
        <img src={png.src} alt="Logo" className='p-4 w-fit h-fit' />
      </div>
      <div className='flex flex-col items-center'>
        <div className='px-13 py-5 m-10 rounded-2xl drop-shadow-2xl bg-[var(--chefchaouen-blue)] dark:bg-slate-800 border-2 border-black'>
          <div className='flex justify-center'>
            <h1 className='text-3xl lg:text-5xl text-black dark:text-white font-serif'>Login</h1>
          </div>
          <div className='flex flex-col gap-2 mt-4'>
            <input
              type="text"
              placeholder="Username"
              value={username}
              className='bg-gray-50 opacity-40 px-5 py-1 rounded-md text-black border-2 border-black'
              onChange={(e) => setUsername(e.target.value)}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              className='bg-gray-50 opacity-40 px-5 py-1 rounded-md text-black border-2 border-black'
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>  
          <div className='flex flex-row justify-evenly my-4 mx-0'>
            <button onClick={handleLogin} className='text-black bg-green-600 text-md flex-1/2 py-0.5 mx-1 my-1 border-2 border-black rounded-sm hover:bg-green-700 focus:outline-1
            dark:text-white'>Login</button>
            <button onClick={handleSignUp} className='text-black bg-blue-600 text-md flex-1/2 py-0.5 mx-1 my-1 border-2 border-black rounded-sm hover:bg-blue-700 focus:outline-1
            dark:text-white'>Sign Up</button>
          </div>
        </div>
        {error && <h1 className='text-md lg:text-xl text-shadow-red-800 text-red-500'>{error}</h1>}
      </div>
      
    </div>
  );
};

export default Login;
