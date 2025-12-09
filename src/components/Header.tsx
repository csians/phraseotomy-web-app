import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { ShoppingBag, User, FileText } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import phraseotomyLogo from "@/assets/phraseotomy-logo.avif";

const Header = () => {
  const [customerName, setCustomerName] = useState<string>("");
  const [customerEmail, setCustomerEmail] = useState<string>("");

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

  return (
    <header className="w-full bg-black py-4 px-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center">
          <img 
            src={phraseotomyLogo} 
            alt="Phraseotomy - The Party Game" 
            className="h-8 w-auto"
          />
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

        {/* User & Cart Icons */}
        <div className="flex items-center gap-4">
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
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={() => window.open("https://shopify.com/95234130268/account/orders?locale=en&region_country=GB", "_blank")}
                  >
                    <FileText className="h-4 w-4" />
                    ORDERS
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={() => window.open("https://shopify.com/95234130268/account/profile?locale=en&region_country=GB", "_blank")}
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
    </header>
  );
};

export default Header;
