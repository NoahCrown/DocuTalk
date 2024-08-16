import {Pinecone} from '@pinecone-database/pinecone'
import { convertToAscii } from './utils';
import { getEmbeddings } from './embeddings';

export async function getMatchesFromEmbeddings(embeddings: number[], file_key: string){
    const pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY!,
    });


    const index = pinecone.index('chat-pdf')

    try {
        const namespace = convertToAscii(file_key)
        const queryResult = await index.namespace(namespace).query({
            vector: embeddings,
            topK: 5,
            includeMetadata: true,
            includeValues: true,
             
            
          });


        return queryResult.matches || []
        
    } catch (error) {
        console.log('Error quering embeddings')
        throw error
        
    }

}

export async function getContext(query:string, file_key:string) {
    const queryEmbeddings = await getEmbeddings(query)
    const matches = await getMatchesFromEmbeddings(queryEmbeddings, file_key)
    const qualifyingDocs = matches.filter(match => match.score && match.score > 0.7)

    type Metadata = {
        text: string,
        pageNumber: number,

    }

    let docs = qualifyingDocs.map(match => (match.metadata as Metadata))
    console.log(docs[0].text)
    return docs.join('\n').substring(0, 3000)

} 