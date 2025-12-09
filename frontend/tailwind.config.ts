import type { Config } from "tailwindcss";
import animatePlugin from "tailwindcss-animate";

const config: Config = {
    darkMode: ["class"],
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
    	extend: {
    		colors: {
    			background: 'hsl(var(--background))',
    			surface: {
    				DEFAULT: 'rgba(255, 255, 255, 0.05)',
    				hover: 'rgba(255, 255, 255, 0.08)'
    			},
    			text: {
    				primary: '#FFFFFF',
    				secondary: '#A0AEC0',
    				tertiary: '#718096'
    			},
    			accent: {
    				primary: '#6366F1',
    				secondary: '#8B5CF6',
    				DEFAULT: 'hsl(var(--accent))',
    				foreground: 'hsl(var(--accent-foreground))'
    			},
    			success: '#10B981',
    			warning: '#F59E0B',
    			error: '#EF4444',
    			info: '#3B82F6',
    			border: 'hsl(var(--border))',
    			foreground: 'hsl(var(--foreground))',
    			card: {
    				DEFAULT: 'hsl(var(--card))',
    				foreground: 'hsl(var(--card-foreground))'
    			},
    			popover: {
    				DEFAULT: 'hsl(var(--popover))',
    				foreground: 'hsl(var(--popover-foreground))'
    			},
    			primary: {
    				DEFAULT: 'hsl(var(--primary))',
    				foreground: 'hsl(var(--primary-foreground))'
    			},
    			secondary: {
    				DEFAULT: 'hsl(var(--secondary))',
    				foreground: 'hsl(var(--secondary-foreground))'
    			},
    			muted: {
    				DEFAULT: 'hsl(var(--muted))',
    				foreground: 'hsl(var(--muted-foreground))'
    			},
    			destructive: {
    				DEFAULT: 'hsl(var(--destructive))',
    				foreground: 'hsl(var(--destructive-foreground))'
    			},
    			input: 'hsl(var(--input))',
    			ring: 'hsl(var(--ring))',
    			chart: {
    				'1': 'hsl(var(--chart-1))',
    				'2': 'hsl(var(--chart-2))',
    				'3': 'hsl(var(--chart-3))',
    				'4': 'hsl(var(--chart-4))',
    				'5': 'hsl(var(--chart-5))'
    			}
    		},
    		fontFamily: {
    			display: [
    				'var(--font-space-grotesk)',
    				'sans-serif'
    			],
    			body: [
    				'var(--font-inter)',
    				'sans-serif'
    			]
    		},
    		borderRadius: {
    			lg: 'var(--radius)',
    			md: 'calc(var(--radius) - 2px)',
    			sm: 'calc(var(--radius) - 4px)'
    		},
    		boxShadow: {
    			custom: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
    			glow: '0 0 20px rgba(14, 165, 233, 0.45)'
    		},
    		backgroundImage: {
    			'gradient-primary': 'linear-gradient(135deg, #1E3A8A 0%, #0EA5E9 50%, #06B6D4 100%)'
    		},
    		animation: {
    			'fade-in-up': 'fadeInUp 0.5s ease-out',
    			'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite'
    		},
    		keyframes: {
    			fadeInUp: {
    				'0%': {
    					opacity: '0',
    					transform: 'translateY(20px)'
    				},
    				'100%': {
    					opacity: '1',
    					transform: 'translateY(0)'
    				}
    			}
    		}
    	}
    },
    plugins: [animatePlugin],
};

export default config;
