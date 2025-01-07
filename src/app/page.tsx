"use client"

import { useEffect, useState } from 'react';

type MessageResponse = {
  message: string;
};

const Home: React.FC = () => {
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    fetch('/api/hello')
      .then((res) => res.json())
      .then((data: MessageResponse) => setMessage(data.message));
  }, []);

  return <div>Backend says: {message}</div>;
};

export default Home;
