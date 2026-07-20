'use client';
import { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

export default function TiltCard({ children, className }) {
  const ref = useRef(null);
  const [hover, setHover] = useState(false);

  // Motion values for pointer coordinates
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Add spring physics for smooth return
  const springConfig = { damping: 20, stiffness: 300, mass: 1 };
  const springX = useSpring(x, springConfig);
  const springY = useSpring(y, springConfig);

  // Map pointer coordinates to rotation degrees (tilt)
  // When mouse is on the far left (-0.5), it rotates 10deg. When on the right (0.5), it rotates -10deg.
  const rotateX = useTransform(springY, [-0.5, 0.5], ["10deg", "-10deg"]);
  const rotateY = useTransform(springX, [-0.5, 0.5], ["-10deg", "10deg"]);

  function handleMouseMove(e) {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    
    // Calculate mouse position relative to the card's center (-0.5 to 0.5)
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    
    x.set(xPct);
    y.set(yPct);
  }

  function handleMouseLeave() {
    setHover(false);
    // Return to center when mouse leaves
    x.set(0);
    y.set(0);
  }

  function handleMouseEnter() {
    setHover(true);
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={handleMouseEnter}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
        perspective: 1000
      }}
      initial={{ y: 0 }}
      animate={{ 
        y: hover ? -10 : 0,
        scale: hover ? 1.02 : 1
      }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      {children}
    </motion.div>
  );
}
