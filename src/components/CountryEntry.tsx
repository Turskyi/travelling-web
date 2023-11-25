import useCountry from "@/hooks/useCountry";
import Link from "next/link";
import styles from '@/styles/CountryEntry.module.css';
import { Spinner } from "react-bootstrap";
import Image from "next/image";

export default function CountryEntry({ name }: { name: string }) {
    const { country, countryLoading } = useCountry(name);
    return (
        <Link href={'/' + name}>
            <div className={styles.entry}>
                {countryLoading && <Spinner animation="grow" />}
                {country &&
                    <div className={styles.card}>
                        <h1 className={`${styles.countryName} text-center text-capitalize`}>{country.name.common}</h1>
                        <Image
                            src={country.flags.svg}
                            alt={'Country: ' + country.name.official}
                            width={300}
                            height={200}
                        />
                    </div>
                }
            </div>
        </Link>
    );
}