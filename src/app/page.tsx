"use client";

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

    <div>
      <h1 className="text-blue-500 underline ">Login</h1>
      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button onClick={handleLogin}>Login</button>
      <button onClick={handleSignUp}>Sign Up</button>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
};

export default Login;
