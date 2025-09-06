'use client';
import { motion } from 'framer-motion';

const TitleAnimation = () => {
  return (
    <motion.h1
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-300 via-cyan-400 to-blue-500 animate-gradient-reveal"
      style={{ backgroundSize: '200% 200%' }}
    >
      Data-Structure AI
    </motion.h1>
  );
};

export default TitleAnimation;
