/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./views/**/*.ejs"],
  theme: {
    extend: {
      // ...existing code...
    },
  },
  plugins: [
    function({ addComponents }) {
      addComponents({
        '.music-container': {
          background: 'rgba(0, 0, 0, 0.5)',
          padding: '10px',
          borderRadius: '8px',
          backdropFilter: 'blur(5px)',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          transition: 'opacity 0.3s ease',
          '&:hover': {
            opacity: '1'
          },
          'iframe': {
            borderRadius: '4px',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
          }
        }
      })
    }
  ],
}
