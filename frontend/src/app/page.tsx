'use client';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
const { user } = useAuth();
const router = useRouter();

useEffect(() => {
if (user) {
router.push('/chat');
} else {
router.push('/login');
}
}, [user, router]);

return (
<div className="flex items-center justify-center h-screen bg-gray-900 text-white">
<p>Loading...</p>
</div>
);
}
