import React, { useState } from 'react';
import { Keypair, SystemProgram, Transaction } from "@solana/web3.js";
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
    MINT_SIZE, TOKEN_2022_PROGRAM_ID, createMintToInstruction, createAssociatedTokenAccountInstruction,
    getMintLen, createInitializeMetadataPointerInstruction, createInitializeMintInstruction,
    TYPE_SIZE, LENGTH_SIZE, ExtensionType, pack, getAssociatedTokenAddressSync
} from "@solana/spl-token";
import { createInitializeInstruction } from '@solana/spl-token-metadata';

export function TokenLaunchpad() {
    const { connection } = useConnection();
    const wallet = useWallet();

    // State to capture form input
    const [name, setName] = useState('');
    const [symbol, setSymbol] = useState('');
    const [image, setImage] = useState('');
    const [initialSupply, setInitialSupply] = useState('');

    async function createToken() {
        try {
            const mintKeypair = Keypair.generate();
            const metadata = {
                mint: mintKeypair.publicKey,
                name: name,
                symbol: symbol,
                uri: image,
                additionalMetadata: [],
            };

            const mintLen = getMintLen([ExtensionType.MetadataPointer]);
            const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;
            const lamports = await connection.getMinimumBalanceForRentExemption(mintLen + metadataLen);

            const transaction = new Transaction().add(
                SystemProgram.createAccount({
                    fromPubkey: wallet.publicKey,
                    newAccountPubkey: mintKeypair.publicKey,
                    space: mintLen,
                    lamports,
                    programId: TOKEN_2022_PROGRAM_ID,
                }),
                createInitializeMetadataPointerInstruction(
                    mintKeypair.publicKey, wallet.publicKey, mintKeypair.publicKey, TOKEN_2022_PROGRAM_ID
                ),
                createInitializeMintInstruction(mintKeypair.publicKey, 9, wallet.publicKey, null, TOKEN_2022_PROGRAM_ID),
                createInitializeInstruction({
                    programId: TOKEN_2022_PROGRAM_ID,
                    mint: mintKeypair.publicKey,
                    metadata: mintKeypair.publicKey,
                    name: metadata.name,
                    symbol: metadata.symbol,
                    uri: metadata.uri,
                    mintAuthority: wallet.publicKey,
                    updateAuthority: wallet.publicKey,
                }),
            );

            transaction.feePayer = wallet.publicKey;
            transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
            transaction.partialSign(mintKeypair);

            await wallet.sendTransaction(transaction, connection);

            console.log(`Token mint created at ${mintKeypair.publicKey.toBase58()}`);
            const associatedToken = getAssociatedTokenAddressSync(
                mintKeypair.publicKey,
                wallet.publicKey,
                false,
                TOKEN_2022_PROGRAM_ID,
            );

            const transaction2 = new Transaction().add(
                createAssociatedTokenAccountInstruction(
                    wallet.publicKey,
                    associatedToken,
                    wallet.publicKey,
                    mintKeypair.publicKey,
                    TOKEN_2022_PROGRAM_ID,
                ),
            );

            await wallet.sendTransaction(transaction2, connection);

            const transaction3 = new Transaction().add(
                createMintToInstruction(mintKeypair.publicKey, associatedToken, wallet.publicKey, Number(initialSupply), [], TOKEN_2022_PROGRAM_ID)
            );

            await wallet.sendTransaction(transaction3, connection);

            console.log("Minted!");
        } catch (error) {
            console.error("Error creating token:", error);
        }
    }

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'column'
        }}>
            <h1>Solana Token Launchpad</h1>
            <input
                className='inputText'
                type='text'
                placeholder='Name'
                value={name}
                onChange={(e) => setName(e.target.value)}
            />
            <br />
            <input
                className='inputText'
                type='text'
                placeholder='Symbol'
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
            />
            <br />
            <input
                className='inputText'
                type='text'
                placeholder='Image URL'
                value={image}
                onChange={(e) => setImage(e.target.value)}
            />
            <br />
            <input
                className='inputText'
                type='text'
                placeholder='Initial Supply'
                value={initialSupply}
                onChange={(e) => setInitialSupply(e.target.value)}
            />
            <br />
            <button onClick={createToken} className='btn'>Create a token</button>
        </div>
    );
}
