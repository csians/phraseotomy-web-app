import { Link } from "react-router-dom";

const Header = () => {
  return (
    <header className="w-full bg-black py-4 px-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex flex-col items-start">
          <span className="text-[10px] text-white/80 tracking-widest uppercase">The Party Game</span>
          <span className="text-xl font-bold text-white tracking-wide">
            PHRASE<span className="text-amber-500">O</span>TOMY
          </span>
        </Link>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          <a 
            href="https://phraseotomy.com/collections/all" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-white text-sm font-medium tracking-wide hover:text-amber-500 transition-colors"
          >
            PRODUCT LIST
          </a>
          <a 
            href="https://phraseotomy.com/pages/retailer-enquiries" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-white text-sm font-medium tracking-wide hover:text-amber-500 transition-colors"
          >
            RETAILER ENQUIRIES
          </a>
          <a 
            href="https://phraseotomy.com/pages/how-to-play" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-white text-sm font-medium tracking-wide hover:text-amber-500 transition-colors"
          >
            HOW TO PLAY
          </a>
          <a 
            href="https://phraseotomy.com/pages/game-assist" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-white text-sm font-medium tracking-wide hover:text-amber-500 transition-colors"
          >
            GAME ASSIST
          </a>
          <a 
            href="https://phraseotomy.com/apps/phraseotomy" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-white text-sm font-medium tracking-wide hover:text-amber-500 transition-colors"
          >
            PLAY ONLINE
          </a>
        </nav>
      </div>
    </header>
  );
};

export default Header;
