import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { ShoppingBag, User, FileText, Menu, Ticket } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import phraseotomyLogo from "@/assets/phraseotomy-logo.avif";

const Header = () => {
  const navigate = useNavigate();
  const [customerName, setCustomerName] = useState<string>("");
  const [customerEmail, setCustomerEmail] = useState<string>("");
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);

  useEffect(() => {
    // Get customer data from localStorage
    const storedCustomer = localStorage.getItem("customerData");
    if (storedCustomer) {
      try {
        const customerData = JSON.parse(storedCustomer);
        setCustomerName(customerData.firstName || customerData.name || "");
        setCustomerEmail(customerData.email || customerData.customer_email || "");
      } catch (e) {
        console.error("Error parsing customer data:", e);
      }
    }
  }, []);

  const getInitial = () => {
    if (customerName) {
      return customerName.charAt(0).toUpperCase();
    }
    return "M";
  };

  const toggleMobileNav = () => {
    setIsMobileNavOpen((prev) => !prev);
  };

  return (
    <header className="w-full bg-black py-4  border-b border-white/10">
      {/* Top bar */}
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center">
          <img
            src={phraseotomyLogo}
            alt="Phraseotomy - The Party Game"
            className="h-8 w-auto"
          />
        </Link>

        {/* Desktop Navigation - switches at 900px */}
        <nav className="hidden header:flex items-center gap-8">
          <a
            href="https://phraseotomy.com/collections/all"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white text-sm font-medium tracking-wide hover:text-amber-500 transition-colors"
          >
            PRODUCT LIST
          </a>
          <a
            href="https://phraseotomy.com/pages/contact"
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
            href="https://phraseotomy.com/pages/game-assistant"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white text-sm font-medium tracking-wide hover:text-amber-500 transition-colors"
          >
            GAME ASSIST
          </a>
          <a
            href="https://phraseotomy.com/pages/play-online"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white text-sm font-medium tracking-wide hover:text-amber-500 transition-colors"
          >
            PLAY ONLINE
          </a>
        </nav>

        <div className="flex items-center gap-3">
          {/* Mobile Menu Button - visible below 900px */}
          <button
            type="button"
            className="header:hidden w-9 h-9 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-colors"
            onClick={toggleMobileNav}
            aria-label={isMobileNavOpen ? "Close menu" : "Open menu"}
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* User Icon with Dropdown */}
          <Popover>
            <PopoverTrigger asChild>
              <button className="w-9 h-9 rounded-full border border-white/30 flex items-center justify-center text-white text-sm font-medium hover:bg-white/10 transition-colors">
                {getInitial()}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-4 bg-white" align="end">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg text-foreground">
                    HI {customerName?.toUpperCase() || "THERE"}
                  </h3>
                  <p className="text-sm text-muted-foreground">{customerEmail}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() =>
                      window.open(
                        "https://shopify.com/95234130268/account/orders?locale=en&region_country=GB",
                        "_blank",
                      )
                    }
                  >
                    <FileText className="h-4 w-4" />
                    ORDERS
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => {
                      // Always open in new window using the proxy path to maintain iframe context
                      window.open("https://phraseotomy.com/apps/phraseotomy#/redeem", "_blank");
                    }}
                  >
                    <Ticket className="h-4 w-4" />
                    REDEEM CODE
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() =>
                      window.open(
                        "https://shopify.com/95234130268/account/profile?locale=en&region_country=GB",
                        "_blank",
                      )
                    }
                  >
                    <User className="h-4 w-4" />
                    PROFILE
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Cart Icon */}
          <a
            href="https://phraseotomy.com/cart"
            target="_blank"
            rel="noopener noreferrer"
            className="w-9 h-9 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-colors"
          >
            <ShoppingBag className="h-5 w-5" />
          </a>
        </div>
      </div>

      {/* Mobile Full-Width Dropdown Navigation (pushes content) - visible below 900px */}
      <nav
        className={`header:hidden w-full bg-black border-t border-white/10 overflow-hidden transition-[max-height] duration-300 ease-in-out ${
          isMobileNavOpen ? "max-h-96" : "max-h-0"
        }`}
      >
        <div className="flex flex-col items-stretch">
          {/* Links */}
          <div className="flex flex-col">
            <a
              href="https://phraseotomy.com/collections/all"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 text-center text-white text-sm font-medium tracking-wide hover:bg-white/10 hover:text-amber-400 active:bg-white/15 transition-colors duration-200 ease-out"
              onClick={toggleMobileNav}
            >
              PRODUCT LIST
            </a>
            <a
              href="https://phraseotomy.com/pages/contact"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 text-center text-white text-sm font-medium tracking-wide hover:bg-white/10 hover:text-amber-400 active:bg-white/15 transition-colors duration-200 ease-out"
              onClick={toggleMobileNav}
            >
              RETAILER ENQUIRIES
            </a>
            <a
              href="https://phraseotomy.com/pages/how-to-play"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 text-center text-white text-sm font-medium tracking-wide hover:bg-white/10 hover:text-amber-400 active:bg-white/15 transition-colors duration-200 ease-out"
              onClick={toggleMobileNav}
            >
              HOW TO PLAY
            </a>
            <a
              href="https://phraseotomy.com/pages/game-assistant"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 text-center text-white text-sm font-medium tracking-wide hover:bg-white/10 hover:text-amber-400 active:bg-white/15 transition-colors duration-200 ease-out"
              onClick={toggleMobileNav}
            >
              GAME ASSIST
            </a>
            <a
              href="https://phraseotomy.com/pages/play-online"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 text-center text-white text-sm font-medium tracking-wide hover:bg-white/10 hover:text-amber-400 active:bg-white/15 transition-colors duration-200 ease-out"
              onClick={toggleMobileNav}
            >
              PLAY ONLINE
            </a>
          </div>
        </div>
      </nav>
    </header>
  );
};

export default Header