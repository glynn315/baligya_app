/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts,scss}'],
  theme: {
    extend: {
      colors: {
        baligya: {
          50:  '#E9F8EE',
          100: '#C9EED5',
          200: '#9EE2B5',
          300: '#6FD392',
          400: '#3FC270',
          500: '#1FA64D', // primary
          600: '#188A3F',
          700: '#126B31',
          800: '#0D4D24',
          900: '#082E15',
        },
        ink: {
          DEFAULT: '#0F1F17',
          soft: '#3A4A41',
          mute: '#6F7E76',
        },
        canvas: {
          DEFAULT: '#FAFBFA',
          soft: '#F2F5F3',
        },
        line: '#E4EAE6',
        danger:  '#E03E3E',
        warning: '#F59E0B',
        success: '#1FA64D',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        xl: '14px',
        '2xl': '20px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,31,23,0.04), 0 4px 16px rgba(15,31,23,0.06)',
        pop:  '0 8px 28px rgba(15,31,23,0.12)',
      },
      screens: {
        xs: '360px',
      },
    },
  },
  corePlugins: {
    preflight: false, // Ionic provides its own normalize; avoid conflicts
  },
  plugins: [],
};
