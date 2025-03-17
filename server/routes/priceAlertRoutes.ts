import express, { Request, Response } from 'express';
import { validatePriceFeedId } from '../utils/validation';

export const priceAlertRoutes = express.Router();

/**
 * Get all price alerts for a user
 */
priceAlertRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const walletAddress = req.user?.walletAddress;
    
    if (!walletAddress) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const alerts = await req.notificationServer.getPriceAlerts(walletAddress);
    
    res.json({ alerts });
  } catch (error) {
    console.error('Error fetching price alerts:', error);
    res.status(500).json({ error: 'Failed to fetch price alerts' });
  }
});

/**
 * Create a new price alert
 */
priceAlertRoutes.post('/', async (req: Request, res: Response) => {
  try {
    const walletAddress = req.user?.walletAddress;
    
    if (!walletAddress) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const { priceFeedId, targetPrice, direction, notificationType } = req.body;
    
    // Validate price feed ID
    if (!validatePriceFeedId(priceFeedId)) {
      return res.status(400).json({ error: 'Invalid price feed ID' });
    }
    
    // Validate target price
    if (typeof targetPrice !== 'number' || targetPrice <= 0) {
      return res.status(400).json({ error: 'Invalid target price' });
    }
    
    // Validate direction
    if (direction !== 'above' && direction !== 'below') {
      return res.status(400).json({ error: 'Direction must be "above" or "below"' });
    }
    
    // Validate notification type
    if (notificationType !== 'email' && notificationType !== 'push') {
      return res.status(400).json({ error: 'Notification type must be "email" or "push"' });
    }
    
    const alertId = await req.notificationServer.createPriceAlert({
      walletAddress,
      priceFeedId,
      targetPrice,
      direction,
      notificationType
    });
    
    res.status(201).json({
      id: alertId,
      walletAddress,
      priceFeedId,
      targetPrice,
      direction,
      notificationType,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error creating price alert:', error);
    res.status(500).json({ error: 'Failed to create price alert' });
  }
});

/**
 * Delete a price alert
 */
priceAlertRoutes.delete('/:alertId', async (req: Request, res: Response) => {
  try {
    const walletAddress = req.user?.walletAddress;
    const { alertId } = req.params;
    
    if (!walletAddress) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const success = await req.notificationServer.deletePriceAlert(alertId, walletAddress);
    
    if (!success) {
      return res.status(404).json({ error: 'Alert not found or not authorized to delete' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting price alert:', error);
    res.status(500).json({ error: 'Failed to delete price alert' });
  }
});

/**
 * Update a price alert
 */
priceAlertRoutes.put('/:alertId', async (req: Request, res: Response) => {
  try {
    const walletAddress = req.user?.walletAddress;
    const { alertId } = req.params;
    const { targetPrice, direction, notificationType } = req.body;
    
    if (!walletAddress) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Validate target price if provided
    if (targetPrice !== undefined && (typeof targetPrice !== 'number' || targetPrice <= 0)) {
      return res.status(400).json({ error: 'Invalid target price' });
    }
    
    // Validate direction if provided
    if (direction !== undefined && direction !== 'above' && direction !== 'below') {
      return res.status(400).json({ error: 'Direction must be "above" or "below"' });
    }
    
    // Validate notification type if provided
    if (notificationType !== undefined && notificationType !== 'email' && notificationType !== 'push') {
      return res.status(400).json({ error: 'Notification type must be "email" or "push"' });
    }
    
    const success = await req.notificationServer.updatePriceAlert(alertId, walletAddress, {
      targetPrice,
      direction,
      notificationType
    });
    
    if (!success) {
      return res.status(404).json({ error: 'Alert not found or not authorized to update' });
    }
    
    const updatedAlert = await req.notificationServer.getPriceAlert(alertId);
    
    res.json(updatedAlert);
  } catch (error) {
    console.error('Error updating price alert:', error);
    res.status(500).json({ error: 'Failed to update price alert' });
  }
});