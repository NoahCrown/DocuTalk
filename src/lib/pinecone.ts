import { Pinecone, PineconeRecord } from '@pinecone-database/pinecone';
import { downloadFromS3 } from './s3-server';
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import {Document, RecursiveCharacterTextSplitter} from '@pinecone-database/doc-splitter'
import { getEmbeddings } from './embeddings';
import md5 from 'md5'
import { convertToAscii } from './utils';

let pc: Pinecone | null = null;

export const getPineconeClient = async () => {
    if (!pc) {
        pc = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY!,
        });
    }
    return pc;
}

type PDFPage = {
    pageContent: string,
    metadata: {
        loc: {pageNumber:number}
    }
}


export async function loadS3IntoPinecone(fileKey: string) {
    console.log('downloading s3 into file system')
    const file_name = await downloadFromS3(fileKey)
    if (!file_name) {
        throw new Error('could not download from s3')
    }
    const loader = new PDFLoader(file_name)
    const pages = (await loader.load()) as PDFPage[]

    const documents = await Promise.all(pages.map(prepareDocument))
    const vectors = await Promise.all(documents.flat().map(embedDocument))

    const client = await getPineconeClient()
    const pineconeIndex = client.index('chat-pdf')
    console.log('inserting vectors into pinecone')
    const namespace = convertToAscii(fileKey)

    try {
        const upsertResponse = await pineconeIndex.namespace(namespace).upsert(vectors)
        console.log('Vectors inserted into Pinecone:', upsertResponse)
    } catch (error) {
        console.error('Error upserting to Pinecone:', error)
        throw error
    }

    return documents
}

async function embedDocument(doc: Document) {
    try {
        const embeddings = await getEmbeddings(doc.pageContent)
        const hash = md5(doc.pageContent)

        return {
            id: hash,
            values:embeddings,
            metadata: {
                text:doc.metadata.text as string,
                pageNumber: doc.metadata.pageNumber  
            }

        } as PineconeRecord
        
    } catch (error) {
        console.log('Error embedding document')
        throw error
        
    }

}

export const truncateStringByBtes = (str:string, bytes:number) => {
    const enc = new TextEncoder()
    return new TextDecoder('utf-8').decode(enc.encode(str).slice(0, bytes))
}

async function prepareDocument(page: PDFPage) {
    let {pageContent, metadata} = page
    pageContent = pageContent.replace('/\n/g', '')

    // Split the docs
    const splitter = new RecursiveCharacterTextSplitter()
    const docs = await splitter.splitDocuments([
        new Document({
            pageContent,
            metadata: {
                pageNumber: metadata.loc.pageNumber,
                text: truncateStringByBtes(pageContent, 36000)

            }
        })
    ])

    return docs

}