import * as tf from '@tensorflow/tfjs-node';
import * as fs from 'fs';
import * as path from 'path';

/**
 * PythPricePredictionModel - A TensorFlow.js model for predicting prices
 * based on historical data from Pyth Network
 */
export class PythPricePredictionModel {
  private model: tf.LayersModel | null = null;
  private isModelLoaded: boolean = false;
  private lookbackWindow: number = 30;
  private predictionHorizon: number = 24; // 24 hours
  private assetId: string;
  private assetSymbol: string;
  
  /**
   * Initialize the price prediction model
   * @param assetId Pyth price feed ID
   * @param assetSymbol Human-readable symbol for the asset
   * @param lookbackWindow Number of data points to use for prediction
   * @param predictionHorizon Number of hours to predict into the future
   */
  constructor(
    assetId: string, 
    assetSymbol: string, 
    lookbackWindow: number = 30,
    predictionHorizon: number = 24
  ) {
    this.assetId = assetId;
    this.assetSymbol = assetSymbol;
    this.lookbackWindow = lookbackWindow;
    this.predictionHorizon = predictionHorizon;
  }
  
  /**
   * Load a pre-trained model
   * @param modelPath Path to the saved model
   */
  public async loadModel(modelPath: string): Promise<void> {
    try {
      this.model = await tf.loadLayersModel(`file://${modelPath}`);
      this.isModelLoaded = true;
      console.log(`Loaded price prediction model for ${this.assetSymbol}`);
    } catch (error) {
      console.error(`Failed to load model for ${this.assetSymbol}:`, error);
      throw new Error(`Could not load model from path: ${modelPath}`);
    }
  }
  
  /**
   * Create and train a new LSTM model
   * @param trainingData Array of price data for training
   * @param epochs Number of training epochs
   * @param savePath Path to save the trained model
   */
  public async trainModel(
    trainingData: number[],
    epochs: number = 100,
    savePath?: string
  ): Promise<void> {
    try {
      console.log(`Training new model for ${this.assetSymbol}...`);
      
      if (trainingData.length < (this.lookbackWindow + this.predictionHorizon)) {
        throw new Error('Not enough training data. Need at least ' + 
          (this.lookbackWindow + this.predictionHorizon) + ' data points.');
      }
      
      // Prepare sequences for LSTM training
      const { sequences, targets } = this.prepareTrainingData(trainingData);
      
      // Create the model architecture
      const model = tf.sequential();
      
      // Add LSTM layers
      model.add(tf.layers.lstm({
        units: 50,
        returnSequences: true,
        inputShape: [this.lookbackWindow, 1],
        activation: 'tanh',
        recurrentActivation: 'hardSigmoid',
      }));
      
      model.add(tf.layers.dropout({ rate: 0.2 }));
      
      model.add(tf.layers.lstm({
        units: 50,
        returnSequences: false,
        activation: 'tanh',
        recurrentActivation: 'hardSigmoid',
      }));
      
      model.add(tf.layers.dropout({ rate: 0.2 }));
      
      // Add output layer
      model.add(tf.layers.dense({
        units: 1,
        activation: 'linear'
      }));
      
      // Compile the model
      model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'meanSquaredError',
        metrics: ['mae']
      });
      
      // Create tensors from the prepared data
      const xs = tf.tensor3d(sequences);
      const ys = tf.tensor2d(targets);
      
      // Train the model
      const history = await model.fit(xs, ys, {
        epochs,
        batchSize: 32,
        validationSplit: 0.2,
        shuffle: true,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            console.log(`Epoch ${epoch + 1}/${epochs} - loss: ${logs?.loss?.toFixed(6)} - val_loss: ${logs?.val_loss?.toFixed(6)}`);
          }
        }
      });
      
      // Save the model if a path is provided
      if (savePath) {
        await model.save(`file://${savePath}`);
        console.log(`Model saved to ${savePath}`);
      }
      
      // Set the trained model
      this.model = model;
      this.isModelLoaded = true;
      
      // Clean up tensors
      xs.dispose();
      ys.dispose();
      
    } catch (error) {
      console.error(`Error training model for ${this.assetSymbol}:`, error);
      throw error;
    }
  }
  
  /**
   * Prepare training data for LSTM model
   * @param data Array of price points
   * @returns Object with sequences and targets
   */
  private prepareTrainingData(
    data: number[]
  ): { sequences: number[][][]; targets: number[][] } {
    const sequences: number[][][] = [];
    const targets: number[][] = [];
    
    // Normalize the data
    const { normalizedData, min, max } = this.normalizeData(data);
    
    // Create sequences for training
    for (let i = 0; i < normalizedData.length - this.lookbackWindow - this.predictionHorizon; i++) {
      const sequence: number[][] = [];
      for (let j = 0; j < this.lookbackWindow; j++) {
        sequence.push([normalizedData[i + j]]);
      }
      sequences.push(sequence);
      targets.push([normalizedData[i + this.lookbackWindow + this.predictionHorizon - 1]]);
    }
    
    return { sequences, targets };
  }
  
  /**
   * Make price predictions
   * @param recentPrices Array of recent price points
   * @param steps Number of steps to predict into the future
   * @returns Predicted prices
   */
  public async predict(recentPrices: number[], steps: number = 1): Promise<number[]> {
    if (!this.isModelLoaded || !this.model) {
      throw new Error('Model is not loaded');
    }
    
    if (recentPrices.length < this.lookbackWindow) {
      throw new Error(`Not enough price data. Need at least ${this.lookbackWindow} data points.`);
    }
    
    try {
      // Use the most recent data points
      const inputData = recentPrices.slice(-this.lookbackWindow);
      
      // Normalize the data
      const { normalizedData, min, max } = this.normalizeData(inputData);
      
      // Prepare input shape
      const reshapedInput: number[][][] = [];
      const sequence: number[][] = [];
      
      for (let i = 0; i < normalizedData.length; i++) {
        sequence.push([normalizedData[i]]);
      }
      reshapedInput.push(sequence);
      
      // Create tensor
      const inputTensor = tf.tensor3d(reshapedInput);
      
      // Make predictions
      const predictions: number[] = [];
      let currentInput = inputTensor;
      
      for (let i = 0; i < steps; i++) {
        // Get prediction
        const predictionTensor = this.model.predict(currentInput) as tf.Tensor;
        const predictionValue = predictionTensor.dataSync()[0];
        
        // Denormalize prediction
        const denormalizedPrediction = this.denormalizeValue(predictionValue, min, max);
        predictions.push(denormalizedPrediction);
        
        // If predicting multiple steps, update input with prediction
        if (steps > 1 && i < steps - 1) {
          // Remove first element and add prediction to end
          const lastSequence = currentInput.slice([0, 1, 0], [1, this.lookbackWindow - 1, 1]);
          
          // Create tensor for the new prediction
          const newValueArray = [[predictionValue]];
          const newPointTensor = tf.tensor3d([newValueArray], [1, 1, 1]);
          
          // Concat to form new input
          currentInput.dispose();
          currentInput = tf.concat([lastSequence, newPointTensor], 1);
          
          // Clean up tensors
          lastSequence.dispose();
          newPointTensor.dispose();
        }
        
        // Clean up tensor
        predictionTensor.dispose();
      }
      
      // Clean up final tensor
      inputTensor.dispose();
      if (currentInput !== inputTensor) {
        currentInput.dispose();
      }
      
      return predictions;
    } catch (error) {
      console.error(`Error making prediction for ${this.assetSymbol}:`, error);
      throw error;
    }
  }
  
  /**
   * Normalize data for model input
   * @param data Array of price data
   * @returns Normalized data and scaling factors
   */
  private normalizeData(data: number[]): { normalizedData: number[]; min: number; max: number } {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min;
    
    if (range === 0) {
      return { normalizedData: data.map(() => 0.5), min, max };
    }
    
    const normalizedData = data.map(value => (value - min) / range);
    return { normalizedData, min, max };
  }
  
  /**
   * Denormalize a predicted value
   * @param value Normalized value
   * @param min Minimum value from normalization
   * @param max Maximum value from normalization
   * @returns Denormalized value
   */
  private denormalizeValue(value: number, min: number, max: number): number {
    return value * (max - min) + min;
  }
  
  /**
   * Evaluate model performance
   * @param testData Test data for evaluation
   * @returns Evaluation metrics
   */
  public async evaluate(testData: number[]): Promise<{mse: number; mae: number}> {
    if (!this.isModelLoaded || !this.model) {
      throw new Error('Model is not loaded');
    }
    
    if (testData.length < this.lookbackWindow + 1) {
      throw new Error(`Not enough test data. Need at least ${this.lookbackWindow + 1} data points.`);
    }
    
    try {
      // Prepare test data
      const { sequences, targets } = this.prepareTrainingData(testData);
      
      // Create tensors
      const xs = tf.tensor3d(sequences);
      const ys = tf.tensor2d(targets);
      
      // Evaluate the model
      const evaluation = await this.model.evaluate(xs, ys) as tf.Tensor[];
      
      // Get metrics
      const mse = evaluation[0].dataSync()[0];
      const mae = evaluation[1] ? evaluation[1].dataSync()[0] : 0;
      
      // Clean up tensors
      xs.dispose();
      ys.dispose();
      evaluation.forEach(tensor => tensor.dispose());
      
      return { mse, mae };
    } catch (error) {
      console.error(`Error evaluating model for ${this.assetSymbol}:`, error);
      throw error;
    }
  }
  
  /**
   * Clean up resources
   */
  public dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
      this.isModelLoaded = false;
    }
  }
}

/**
 * Create a model for BTC/USD price prediction
 */
export async function createBTCUSDModel(
  trainingDataPath: string,
  outputModelPath: string
): Promise<void> {
  // BTC/USD Pyth price feed ID
  const assetId = "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43";
  
  try {
    // Create model instance
    const model = new PythPricePredictionModel(assetId, "BTC/USD", 48, 24);
    
    // Load training data
    const trainingData = JSON.parse(fs.readFileSync(trainingDataPath, 'utf8'));
    
    // Ensure output directory exists
    const outputDir = path.dirname(outputModelPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Train model
    await model.trainModel(trainingData.prices, 200, outputModelPath);
    
    console.log("BTC/USD model training complete!");
    
    // Dispose resources
    model.dispose();
    
  } catch (error) {
    console.error("Error creating BTC/USD model:", error);
    throw error;
  }
}

// Example usage:
// createBTCUSDModel('./data/btc_training_data.json', './models/btc_model');