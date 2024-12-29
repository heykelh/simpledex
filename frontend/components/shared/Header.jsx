import { ConnectButton } from "@rainbow-me/rainbowkit";
import Image from "next/image";

const Header = () => {
    return (
        <nav className="navbar">
            <Image
            src="/images/MiniSwap_logo.png"
            alt="MiniSwap"
            width={100}
            height={100}
            priority
            style={{ height: "auto" }}
          />
            <div>
                <ConnectButton />
            </div>
        </nav>
    )
}

export default Header;